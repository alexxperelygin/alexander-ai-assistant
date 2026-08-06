import { describe, expect, it } from "vitest";
import { computeFeatures } from "../src/lib/features/compute";
import type { MarketSnapshot } from "../src/lib/types";

const now = new Date("2026-01-01T12:00:00Z");

const snapshot: MarketSnapshot = {
  source: "test",
  dataMode: "mock",
  observedAt: now,
  priceUsd: 0.001,
  liquidityUsd: 50_000,
  volume5mUsd: 5_000,
  volume1hUsd: 30_000,
  volume24hUsd: 200_000,
  buys1h: 300,
  sells1h: 150,
  priceChange1h: 15,
  priceChange24h: 40,
};

describe("computeFeatures", () => {
  it("derives ratios from observed values", () => {
    const f = computeFeatures({
      snapshot, risk: null, sellQuote: null,
      pairCreatedAt: new Date(now.getTime() - 3 * 60 * 60_000),
      hasSocials: true, now,
    });
    expect(f.tokenAgeMin).toBe(180);
    expect(f.volAccel).toBeCloseTo((5000 * 12) / 30000); // 2.0
    expect(f.buySellRatio1h).toBeCloseTo(2);
    expect(f.volToLiq).toBeCloseTo(4);
    expect(f.dataGaps).toContain("risk-report");
    expect(f.dataGaps).toContain("sell-quote");
  });

  it("records gaps instead of inventing values when inputs are missing", () => {
    const f = computeFeatures({
      snapshot: null, risk: null, sellQuote: null, pairCreatedAt: null, hasSocials: false, now,
    });
    expect(f.priceUsd).toBeNull();
    expect(f.volAccel).toBeNull();
    expect(f.dataGaps).toContain("market-snapshot");
    expect(f.dataGaps).toContain("pair-created-at");
  });
});

describe("non-finite input sanitation", () => {
  it("converts NaN/Infinity from providers into null + data gap", () => {
    const dirty: MarketSnapshot = {
      ...snapshot,
      priceUsd: NaN,
      volume24hUsd: Infinity,
    };
    const f = computeFeatures({
      snapshot: dirty, risk: null, sellQuote: null,
      pairCreatedAt: new Date(now.getTime() - 3 * 60 * 60_000),
      hasSocials: false, now,
    });
    expect(f.priceUsd).toBeNull();
    expect(f.volume24hUsd).toBeNull();
    expect(f.dataGaps).toContain("price");
    for (const v of Object.values(f)) {
      if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("marks volAccel unknown for tokens younger than 1 hour", () => {
    const f = computeFeatures({
      snapshot, risk: null, sellQuote: null,
      pairCreatedAt: new Date(now.getTime() - 10 * 60_000),
      hasSocials: false, now,
    });
    expect(f.volAccel).toBeNull();
  });
});

describe("liquidity trend", () => {
  const base = {
    snapshot: {
      source: "test", dataMode: "live" as const, observedAt: new Date(),
      priceUsd: 1, liquidityUsd: 90_000, volume24hUsd: 100_000,
    },
    risk: null,
    sellQuote: null,
    pairCreatedAt: new Date(Date.now() - 3 * 3600_000),
    hasSocials: false,
  };

  it("measures the drop against the previous observation", () => {
    const f = computeFeatures({
      ...base,
      previousLiquidity: 100_000,
      previousLiquidityAt: new Date(Date.now() - 15 * 60_000),
    });
    expect(f.liqTrendPct).toBeCloseTo(-10);
  });

  it("reports no trend when the previous observation is too old", () => {
    const f = computeFeatures({
      ...base,
      previousLiquidity: 100_000,
      previousLiquidityAt: new Date(Date.now() - 5 * 3600_000),
    });
    expect(f.liqTrendPct).toBeNull();
  });

  it("reports no trend when there is nothing to compare with", () => {
    expect(computeFeatures(base).liqTrendPct).toBeNull();
  });
});
