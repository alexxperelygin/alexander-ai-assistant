import { prisma } from "../db";
import {
  aggregate,
  evaluateSignal,
  HORIZONS_MIN,
  type PricePoint,
  type SignalOutcome,
  type SignalRecord,
} from "./metrics";

// Backtest over data this system itself collected (TokenSnapshot history).
// Honesty rules:
//  - a signal's inputs are the features stored AT decision time (featuresRef);
//  - outcomes are measured only on snapshots recorded AFTER the signal;
//  - mock-mode records are excluded from live backtests and vice versa;
//  - if the dataset is too small the run reports NO_DATA instead of numbers.
//
// This measures the system's own signal quality going forward. A deep
// historical backtest of tokens from before the system started requires a paid
// historical data source (см. docs/BACKTEST_METHODOLOGY.md).

const MIN_SIGNALS_FOR_METRICS = 20;

export interface BacktestParams {
  dataMode: "live" | "mock";
  horizon: keyof typeof HORIZONS_MIN;
  positionUsd: number;
  /** Which lifecycle statuses count as "the strategy fired". */
  entryStatuses: string[];
}

export const DEFAULT_BACKTEST_PARAMS: BacktestParams = {
  dataMode: "live",
  horizon: "24h",
  positionUsd: 50,
  entryStatuses: ["READY"],
};

export async function runBacktest(params: BacktestParams = DEFAULT_BACKTEST_PARAMS) {
  const run = await prisma.backtestRun.create({
    data: { status: "RUNNING", params: JSON.stringify(params) },
  });
  try {
    const events = await prisma.signalEvent.findMany({
      where: { toStatus: { in: params.entryStatuses } },
      include: { opportunity: { include: { token: true } } },
      orderBy: { createdAt: "asc" },
    });
    const modeEvents = events.filter((e) => e.opportunity.dataMode === params.dataMode);

    // Deduplicate: borderline tokens can emit repeated READY transitions;
    // counting each repeat as an independent trade would double-weight one
    // token's outcome. Keep the first signal per token per 6-hour window.
    const lastKept = new Map<string, number>();
    const filtered = modeEvents.filter((ev) => {
      const prev = lastKept.get(ev.opportunity.tokenId);
      if (prev != null && ev.createdAt.getTime() - prev < 6 * 3600_000) return false;
      lastKept.set(ev.opportunity.tokenId, ev.createdAt.getTime());
      return true;
    });

    const strategyOutcomes: SignalOutcome[] = [];
    for (const ev of filtered) {
      const rec = await toSignalRecord(ev.id, ev.opportunity.token.symbol, ev.opportunity.tokenId, ev.createdAt, params);
      if (!rec) continue;
      const forward = await forwardSeries(ev.opportunity.tokenId, ev.createdAt, params.dataMode);
      strategyOutcomes.push(evaluateSignal(rec, forward));
    }

    // Baseline: "buy every token at its first observed snapshot" — the naive
    // strategy the scoring must beat to prove selection adds value. It must be
    // drawn from the SAME period as the signals, otherwise the comparison is
    // between two different markets.
    const signalFrom = filtered[0]?.createdAt ?? null;
    const signalTo = filtered[filtered.length - 1]?.createdAt ?? null;
    const baselineOutcomes = await baselineAllTokens(params, signalFrom, signalTo);

    const strategy = aggregate(strategyOutcomes, params.horizon);
    const baseline = aggregate(baselineOutcomes, params.horizon);

    // The gate must count MEASURABLE outcomes at this horizon, not raw
    // signals: 34 signals with 2 evaluable outcomes is still NO_DATA, and an
    // "edge" verdict on n=2 would be an overclaim.
    const insufficient = strategy.evaluable < MIN_SIGNALS_FOR_METRICS;

    const from = filtered[0]?.createdAt ?? null;
    const to = filtered[filtered.length - 1]?.createdAt ?? null;

    const verdict = insufficient
      ? `NO_DATA: сигналов ${strategyOutcomes.length}, но измеримых исходов на горизонте ${params.horizon} только ${strategy.evaluable} (< ${MIN_SIGNALS_FOR_METRICS}). Выводов о преимуществе сделать нельзя.`
      : edgeVerdict(strategy, baseline);

    const done = await prisma.backtestRun.update({
      where: { id: run.id },
      data: {
        status: insufficient ? "NO_DATA" : "DONE",
        periodFrom: from,
        periodTo: to,
        metrics: JSON.stringify({ strategy, baseline, verdict }),
        notes: verdict,
      },
    });
    return done;
  } catch (err) {
    await prisma.backtestRun.update({
      where: { id: run.id },
      data: { status: "FAILED", notes: String(err) },
    });
    throw err;
  }
}

function edgeVerdict(
  s: ReturnType<typeof aggregate>,
  b: ReturnType<typeof aggregate>,
): string {
  if (s.expectancy == null) return "NO_DATA: нет измеримых исходов на выбранном горизонте.";
  if (s.expectancy <= 0)
    return `NO EDGE: expectancy ${(s.expectancy * 100).toFixed(1)}% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.`;
  // Базовая линия покрывается хуже стратегии: сканер доопрашивает свои сигналы
  // чаще, чем случайные токены, поэтому измеримых исходов у неё в разы меньше.
  // Сравнивать положительный результат стратегии с базой из единиц наблюдений
  // нельзя — это сравнение с шумом, и именно так рождается ложный edge.
  if (b.evaluable < MIN_SIGNALS_FOR_METRICS)
    return `NO_DATA для сравнения: у стратегии expectancy ${(s.expectancy * 100).toFixed(1)}%, но базовая линия измерима лишь на ${b.evaluable} исходах (< ${MIN_SIGNALS_FOR_METRICS}). Без сопоставимой базы заявлять преимущество нельзя.`;
  if (b.expectancy != null && s.expectancy <= b.expectancy)
    return `NO EDGE vs baseline: стратегия ${(s.expectancy * 100).toFixed(1)}% не лучше наивной покупки всего подряд ${(b.expectancy * 100).toFixed(1)}%. Отбор не добавляет ценности.`;
  return `PRELIMINARY EDGE: expectancy ${(s.expectancy * 100).toFixed(1)}% > baseline ${((b.expectancy ?? 0) * 100).toFixed(1)}% (база: ${b.evaluable} исходов). Требуется больше данных и out-of-sample подтверждение прежде чем доверять.`;
}

async function toSignalRecord(
  id: string,
  symbol: string,
  tokenId: string,
  at: Date,
  params: BacktestParams,
): Promise<SignalRecord | null> {
  // Entry price = last snapshot at/before the signal (data available at decision time).
  const snap = await prisma.tokenSnapshot.findFirst({
    where: { tokenId, fetchedAt: { lte: at }, dataMode: params.dataMode, priceUsd: { gt: 0 } },
    orderBy: { fetchedAt: "desc" },
  });
  if (!snap?.priceUsd) return null;
  return {
    id,
    symbol,
    at,
    entryPriceUsd: snap.priceUsd,
    entryLiquidityUsd: snap.liquidityUsd,
    positionUsd: params.positionUsd,
  };
}

async function forwardSeries(tokenId: string, after: Date, dataMode: string): Promise<PricePoint[]> {
  const snaps = await prisma.tokenSnapshot.findMany({
    where: { tokenId, fetchedAt: { gt: after }, dataMode, priceUsd: { gt: 0 } },
    orderBy: { fetchedAt: "asc" },
    take: 2000,
  });
  return snaps.map((s) => ({ at: s.fetchedAt, priceUsd: s.priceUsd as number, liquidityUsd: s.liquidityUsd }));
}

/** Сколько токенов берём в базовую линию: каждый требует отдельного запроса истории. */
const BASELINE_SAMPLE = 2000;

function fetchTokenBatch(ids: string[], dataMode: string) {
  return prisma.token.findMany({
    where: { id: { in: ids }, snapshots: { some: { dataMode } } },
    include: {
      snapshots: {
        where: { dataMode, priceUsd: { gt: 0 } },
        orderBy: { fetchedAt: "asc" },
        take: 1,
      },
    },
  });
}

async function baselineAllTokens(
  params: BacktestParams,
  from: Date | null,
  to: Date | null,
): Promise<SignalOutcome[]> {
  // Без окна и сортировки `take: 2000` возвращал самые СТАРЫЕ токены в базе —
  // базовая линия считалась по другому периоду рынка, чем сигналы, и сравнение
  // «стратегия vs рынок» было бессмысленным. Берём токены, впервые увиденные в
  // том же интервале, что и сигналы (fallback — последние 7 дней).
  const windowFrom = from ?? new Date(Date.now() - 7 * 24 * 3600_000);
  const windowTo = to ?? new Date();

  // Токенов в окне могут быть сотни тысяч, а на каждый нужен отдельный запрос
  // истории. Поэтому берём равномерную подвыборку по времени появления: просто
  // `take: N` дал бы только начало окна, то есть снова другой период.
  const ids = await prisma.token.findMany({
    where: { firstSeenAt: { gte: windowFrom, lte: windowTo } },
    orderBy: { firstSeenAt: "asc" },
    select: { id: true },
  });
  const stride = Math.max(1, Math.ceil(ids.length / BASELINE_SAMPLE));
  const sampled = ids.filter((_, i) => i % stride === 0).map((t) => t.id);

  // `IN (...)` разбивается на пачки: SQLite ограничивает число параметров в
  // запросе (на этом уже спотыкался бэктест).
  const tokens: Awaited<ReturnType<typeof fetchTokenBatch>> = [];
  for (let i = 0; i < sampled.length; i += 500) {
    tokens.push(...(await fetchTokenBatch(sampled.slice(i, i + 500), params.dataMode)));
  }
  const outcomes: SignalOutcome[] = [];
  for (const t of tokens) {
    const first = t.snapshots[0];
    if (!first?.priceUsd) continue;
    const rec: SignalRecord = {
      id: `baseline-${t.id}`,
      symbol: t.symbol,
      at: first.fetchedAt,
      entryPriceUsd: first.priceUsd,
      entryLiquidityUsd: first.liquidityUsd,
      positionUsd: params.positionUsd,
    };
    const forward = await forwardSeries(t.id, first.fetchedAt, params.dataMode);
    outcomes.push(evaluateSignal(rec, forward));
  }
  return outcomes;
}
