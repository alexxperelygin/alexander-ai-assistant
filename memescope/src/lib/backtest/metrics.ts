import { simulateFill } from "../paper/execution";

// Pure backtest core: given historical signal records and their forward price
// series, compute net outcomes and aggregate honest metrics. No look-ahead:
// a signal may only use data at/before its timestamp; forward series are used
// exclusively for outcome measurement.

export interface PricePoint {
  at: Date;
  priceUsd: number;
  liquidityUsd: number | null;
}

export interface SignalRecord {
  id: string;
  symbol: string;
  at: Date;
  entryPriceUsd: number;
  entryLiquidityUsd: number | null;
  positionUsd: number;
}

export interface SignalOutcome {
  id: string;
  symbol: string;
  at: Date;
  /** Net return fraction per horizon key (e.g. "1h" → 0.42 = +42%), null = no data at that horizon. */
  netReturns: Record<string, number | null>;
  rugged: boolean; // liquidity collapsed below 20% of entry within max horizon
  unclosable: boolean; // no forward data or liquidity too thin to simulate exit
  /** At least one forward observation existed, so "rugged" was actually testable. */
  rugMeasurable: boolean;
}

export const HORIZONS_MIN: Record<string, number> = {
  "1h": 60,
  "6h": 360,
  "24h": 1440,
  "3d": 4320,
  "7d": 10080,
};

export function evaluateSignal(sig: SignalRecord, forward: PricePoint[]): SignalOutcome {
  const after = forward
    .filter((p) => p.at.getTime() > sig.at.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const entryFill = simulateFill({
    sideUsd: sig.positionUsd,
    priceUsd: sig.entryPriceUsd,
    liquidityUsd: sig.entryLiquidityUsd,
    direction: "buy",
  });

  const netReturns: Record<string, number | null> = {};
  let rugged = false;
  let anyExit = false;
  // Whether the liquidity test could run at all. Without this, a signal we
  // never observed again counts as "not rugged" and dilutes the rug rate —
  // the metric would improve simply by losing sight of dying tokens.
  let rugMeasurable = false;

  for (const [key, minutes] of Object.entries(HORIZONS_MIN)) {
    const deadline = sig.at.getTime() + minutes * 60_000;
    // Latest observation at or before the horizon deadline (no look-ahead past it).
    const candidates = after.filter((p) => p.at.getTime() <= deadline);
    const exitPoint = candidates[candidates.length - 1];
    // Require an observation in the second half of the horizon window so a
    // 5-minute-later snapshot doesn't masquerade as a "24h" outcome.
    if (!exitPoint || exitPoint.at.getTime() < sig.at.getTime() + (minutes * 60_000) / 2) {
      netReturns[key] = null;
      continue;
    }
    if (exitPoint.liquidityUsd != null && sig.entryLiquidityUsd != null) {
      rugMeasurable = true;
      if (exitPoint.liquidityUsd < sig.entryLiquidityUsd * 0.2) rugged = true;
    }
    const exitFill = simulateFill({
      sideUsd: sig.positionUsd * (exitPoint.priceUsd / sig.entryPriceUsd),
      priceUsd: exitPoint.priceUsd,
      liquidityUsd: exitPoint.liquidityUsd,
      direction: "sell",
    });
    if (!entryFill.executed || !exitFill.executed) {
      netReturns[key] = null;
      continue;
    }
    anyExit = true;
    const qty = entryFill.quantity;
    const proceeds = qty * exitFill.effectivePriceUsd - exitFill.feesUsd;
    netReturns[key] = proceeds / sig.positionUsd - 1;
  }

  return {
    id: sig.id,
    symbol: sig.symbol,
    at: sig.at,
    netReturns,
    rugged,
    unclosable: !anyExit,
    rugMeasurable,
  };
}

export interface AggregateMetrics {
  signals: number;
  horizon: string;
  evaluable: number; // signals with data at the horizon
  winRate: number | null;
  expectancy: number | null; // mean net return
  medianReturn: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null; // on equity curve of sequential trades
  /** Share of RUG-MEASURABLE signals whose liquidity collapsed (null = none measurable). */
  rugRate: number | null;
  rugMeasurable: number;
  unclosablePct: number;
  byMonth: Record<string, { n: number; meanReturn: number }>;
}

export function aggregate(outcomes: SignalOutcome[], horizon: string): AggregateMetrics {
  const rets = outcomes
    .map((o) => o.netReturns[horizon])
    .filter((r): r is number => r != null);
  const wins = rets.filter((r) => r > 0);
  const losses = rets.filter((r) => r <= 0);
  const grossWin = wins.reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r, 0));

  // Equity curve: sequential unit-stake trades ordered by signal time.
  const ordered = outcomes
    .filter((o) => o.netReturns[horizon] != null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  let equity = 1, peak = 1, maxDd = 0;
  for (const o of ordered) {
    equity *= 1 + (o.netReturns[horizon] as number);
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, (peak - equity) / peak);
  }

  const rugTestable = outcomes.filter((o) => o.rugMeasurable);

  const byMonth: Record<string, { n: number; meanReturn: number }> = {};
  for (const o of ordered) {
    const key = o.at.toISOString().slice(0, 7);
    const r = o.netReturns[horizon] as number;
    const cur = byMonth[key] ?? { n: 0, meanReturn: 0 };
    byMonth[key] = { n: cur.n + 1, meanReturn: (cur.meanReturn * cur.n + r) / (cur.n + 1) };
  }

  return {
    signals: outcomes.length,
    horizon,
    evaluable: rets.length,
    winRate: rets.length ? wins.length / rets.length : null,
    expectancy: rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : null,
    medianReturn: rets.length ? median(rets) : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length > 0 ? Infinity : null,
    maxDrawdown: ordered.length ? maxDd : null,
    rugRate: rugTestable.length
      ? rugTestable.filter((o) => o.rugged).length / rugTestable.length
      : null,
    rugMeasurable: rugTestable.length,
    unclosablePct: outcomes.length
      ? outcomes.filter((o) => o.unclosable).length / outcomes.length
      : 0,
    byMonth,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}
