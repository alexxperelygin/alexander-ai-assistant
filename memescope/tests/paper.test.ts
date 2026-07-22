import { describe, expect, it } from "vitest";
import { simulateFill } from "../src/lib/paper/execution";

describe("simulateFill", () => {
  it("buy fills above mid price (impact + latency drift are adverse)", () => {
    const f = simulateFill({ sideUsd: 100, priceUsd: 1, liquidityUsd: 100_000, direction: "buy" });
    expect(f.executed).toBe(true);
    expect(f.effectivePriceUsd).toBeGreaterThan(1);
    expect(f.feesUsd).toBeGreaterThan(0);
  });

  it("sell fills below mid price", () => {
    const f = simulateFill({ sideUsd: 100, priceUsd: 1, liquidityUsd: 100_000, direction: "sell" });
    expect(f.executed).toBe(true);
    expect(f.effectivePriceUsd).toBeLessThan(1);
  });

  it("impact grows with trade size relative to pool depth", () => {
    const small = simulateFill({ sideUsd: 50, priceUsd: 1, liquidityUsd: 50_000, direction: "buy" });
    const big = simulateFill({ sideUsd: 5_000, priceUsd: 1, liquidityUsd: 50_000, direction: "buy" });
    expect(big.impactPct).toBeGreaterThan(small.impactPct);
    // 5k into a 25k one-sided depth: 5000/(25000+5000) ≈ 16.7%
    expect(big.impactPct).toBeCloseTo(16.67, 1);
  });

  it("prefers an observed aggregator impact over the model", () => {
    const f = simulateFill({
      sideUsd: 100, priceUsd: 1, liquidityUsd: 100_000, direction: "buy", observedImpactPct: 7,
    });
    expect(f.impactPct).toBe(7);
  });

  it("refuses to fill when liquidity is unknown", () => {
    const f = simulateFill({ sideUsd: 100, priceUsd: 1, liquidityUsd: null, direction: "buy" });
    expect(f.executed).toBe(false);
  });

  it("refuses nonsense inputs", () => {
    expect(simulateFill({ sideUsd: 0, priceUsd: 1, liquidityUsd: 1000, direction: "buy" }).executed).toBe(false);
    expect(simulateFill({ sideUsd: 10, priceUsd: 0, liquidityUsd: 1000, direction: "buy" }).executed).toBe(false);
  });

  it("round trip on a fair price loses roughly the friction costs", () => {
    const buy = simulateFill({ sideUsd: 100, priceUsd: 1, liquidityUsd: 200_000, direction: "buy" });
    const sellValue = buy.quantity * 1; // price unchanged
    const sell = simulateFill({ sideUsd: sellValue, priceUsd: 1, liquidityUsd: 200_000, direction: "sell" });
    const proceeds = buy.quantity * sell.effectivePriceUsd - sell.feesUsd;
    expect(proceeds).toBeLessThan(100); // no free lunch
    expect(proceeds).toBeGreaterThan(97); // ...but costs are bounded (~1-2%)
  });
});
