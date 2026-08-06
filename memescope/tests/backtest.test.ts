import { describe, expect, it } from "vitest";
import {
  aggregate,
  evaluateSignal,
  type PricePoint,
  type SignalRecord,
} from "../src/lib/backtest/metrics";

const t0 = new Date("2026-01-01T00:00:00Z");
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

const sig: SignalRecord = {
  id: "s1",
  symbol: "TEST",
  at: t0,
  entryPriceUsd: 1,
  entryLiquidityUsd: 100_000,
  positionUsd: 50,
};

function pts(...items: [number, number, number | null][]): PricePoint[] {
  return items.map(([m, price, liq]) => ({ at: min(m), priceUsd: price, liquidityUsd: liq }));
}

describe("evaluateSignal", () => {
  it("measures net return at a horizon after costs", () => {
    const out = evaluateSignal(sig, pts([55, 2, 100_000]));
    const r1h = out.netReturns["1h"];
    expect(r1h).not.toBeNull();
    // Price doubled; net must be below +100% because of fees/impact/drift.
    expect(r1h!).toBeGreaterThan(0.9);
    expect(r1h!).toBeLessThan(1.0);
  });

  it("returns null for horizons without data in the second half of the window", () => {
    const out = evaluateSignal(sig, pts([5, 1.5, 100_000]));
    expect(out.netReturns["1h"]).toBeNull(); // only a 5-minute point exists
  });

  it("ignores points before the signal (no look-ahead into the past)", () => {
    const out = evaluateSignal(sig, [
      { at: min(-30), priceUsd: 99, liquidityUsd: 100_000 },
      ...pts([50, 1.1, 100_000]),
    ]);
    expect(out.netReturns["1h"]).toBeGreaterThan(0);
    expect(out.netReturns["1h"]).toBeLessThan(0.2);
  });

  it("does not use points beyond the horizon deadline", () => {
    const out = evaluateSignal(sig, pts([50, 1.0, 100_000], [3000, 100, 100_000]));
    // 1h outcome must use the t+50m point (flat), not the t+50h moonshot.
    expect(out.netReturns["1h"]).toBeLessThan(0.05);
  });

  it("detects a rug via liquidity collapse", () => {
    const out = evaluateSignal(sig, pts([40, 0.05, 5_000]));
    expect(out.rugged).toBe(true);
  });

  it("marks unclosable when there is no forward data", () => {
    const out = evaluateSignal(sig, []);
    expect(out.unclosable).toBe(true);
  });

  it("does not claim 'no rug' when the rug test could not run", () => {
    // Ни одного наблюдения после сигнала — про ликвидность ничего не известно.
    // Такой сигнал не должен улучшать rug rate, он должен выпадать из знаменателя.
    const noData = evaluateSignal(sig, []);
    expect(noData.rugged).toBe(false);
    expect(noData.rugMeasurable).toBe(false);

    // Наблюдение есть, но без данных о ликвидности — тоже не измеримо.
    const noLiquidity = evaluateSignal(sig, pts([40, 1.1, null]));
    expect(noLiquidity.rugMeasurable).toBe(false);

    const measured = evaluateSignal(sig, pts([40, 0.05, 5_000]));
    expect(measured.rugMeasurable).toBe(true);
  });
});

describe("aggregate", () => {
  it("computes win rate, expectancy and drawdown over outcomes", () => {
    const outcomes = [
      { id: "a", symbol: "A", at: min(0), netReturns: { "1h": 0.5 }, rugged: false, unclosable: false, rugMeasurable: true },
      { id: "b", symbol: "B", at: min(1), netReturns: { "1h": -0.5 }, rugged: true, unclosable: false, rugMeasurable: true },
      { id: "c", symbol: "C", at: min(2), netReturns: { "1h": null }, rugged: false, unclosable: true, rugMeasurable: false },
    ];
    const m = aggregate(outcomes, "1h");
    expect(m.signals).toBe(3);
    expect(m.evaluable).toBe(2);
    expect(m.winRate).toBeCloseTo(0.5);
    expect(m.expectancy).toBeCloseTo(0);
    // Токен без наблюдений после сигнала не «не ругнулся» — он просто не измерен,
    // поэтому в знаменателе только 2 измеримых.
    expect(m.rugRate).toBeCloseTo(1 / 2);
    expect(m.rugMeasurable).toBe(2);
    expect(m.unclosablePct).toBeCloseTo(1 / 3);
    // Equity: 1 → 1.5 → 0.75; peak 1.5, dd = 50%.
    expect(m.maxDrawdown).toBeCloseTo(0.5);
  });

  it("handles the empty case without inventing numbers", () => {
    const m = aggregate([], "24h");
    expect(m.winRate).toBeNull();
    expect(m.expectancy).toBeNull();
    expect(m.medianReturn).toBeNull();
  });
});
