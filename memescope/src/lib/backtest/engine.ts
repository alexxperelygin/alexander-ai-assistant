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
    const filtered = events.filter((e) => e.opportunity.dataMode === params.dataMode);

    const strategyOutcomes: SignalOutcome[] = [];
    for (const ev of filtered) {
      const rec = await toSignalRecord(ev.id, ev.opportunity.token.symbol, ev.opportunity.tokenId, ev.createdAt, params);
      if (!rec) continue;
      const forward = await forwardSeries(ev.opportunity.tokenId, ev.createdAt, params.dataMode);
      strategyOutcomes.push(evaluateSignal(rec, forward));
    }

    // Baseline: "buy every token at its first observed snapshot" — the naive
    // strategy the scoring must beat to prove selection adds value.
    const baselineOutcomes = await baselineAllTokens(params);

    const insufficient = strategyOutcomes.length < MIN_SIGNALS_FOR_METRICS;
    const strategy = aggregate(strategyOutcomes, params.horizon);
    const baseline = aggregate(baselineOutcomes, params.horizon);

    const from = filtered[0]?.createdAt ?? null;
    const to = filtered[filtered.length - 1]?.createdAt ?? null;

    const verdict = insufficient
      ? `NO_DATA: только ${strategyOutcomes.length} сигналов (< ${MIN_SIGNALS_FOR_METRICS}). Выводов о преимуществе сделать нельзя.`
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
  if (b.expectancy != null && s.expectancy <= b.expectancy)
    return `NO EDGE vs baseline: стратегия ${(s.expectancy * 100).toFixed(1)}% не лучше наивной покупки всего подряд ${(b.expectancy * 100).toFixed(1)}%. Отбор не добавляет ценности.`;
  return `PRELIMINARY EDGE: expectancy ${(s.expectancy * 100).toFixed(1)}% > baseline ${((b.expectancy ?? 0) * 100).toFixed(1)}%. Требуется больше данных и out-of-sample подтверждение прежде чем доверять.`;
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
    where: { tokenId, fetchedAt: { lte: at }, dataMode: params.dataMode, priceUsd: { not: null } },
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
    where: { tokenId, fetchedAt: { gt: after }, dataMode, priceUsd: { not: null } },
    orderBy: { fetchedAt: "asc" },
    take: 2000,
  });
  return snaps.map((s) => ({ at: s.fetchedAt, priceUsd: s.priceUsd as number, liquidityUsd: s.liquidityUsd }));
}

async function baselineAllTokens(params: BacktestParams): Promise<SignalOutcome[]> {
  const tokens = await prisma.token.findMany({
    where: { snapshots: { some: { dataMode: params.dataMode } } },
    include: {
      snapshots: {
        where: { dataMode: params.dataMode, priceUsd: { not: null } },
        orderBy: { fetchedAt: "asc" },
        take: 1,
      },
    },
    take: 2000,
  });
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
