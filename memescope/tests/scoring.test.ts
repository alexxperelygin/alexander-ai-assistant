import { describe, expect, it } from "vitest";
import { computeScores, ramp, tri } from "../src/lib/scoring/engine";
import type { ContractRiskReport, FeatureVector } from "../src/lib/types";

function baseFeatures(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    computedAt: new Date("2026-01-01T00:00:00Z"),
    tokenAgeMin: 120,
    priceUsd: 0.0001,
    liquidityUsd: 80_000,
    fdvUsd: 900_000,
    marketCapUsd: 800_000,
    volume1hUsd: 60_000,
    volume24hUsd: 300_000,
    volAccel: 2.5,
    buySellRatio1h: 1.8,
    txns1h: 500,
    priceChange1h: 25,
    priceChange24h: 80,
    volToLiq: 3.75,
    fdvToLiq: 11.25,
    holders: 1500,
    top10Pct: 22,
    lpLockedPct: 100,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    rugged: false,
    sellRouteOk: true,
    sellImpactPct: 1.2,
    hasSocials: true,
    dataGaps: [],
    ...overrides,
  };
}

const cleanRisk: ContractRiskReport = {
  source: "test",
  dataMode: "mock",
  riskLevel: "low",
  flags: [],
};

describe("score primitives", () => {
  it("ramp clamps to [0,100]", () => {
    expect(ramp(-5, 0, 10)).toBe(0);
    expect(ramp(5, 0, 10)).toBe(50);
    expect(ramp(50, 0, 10)).toBe(100);
  });
  it("tri peaks at 100 and falls to 0 at edges", () => {
    expect(tri(2.5, 0.5, 2.5, 8)).toBe(100);
    expect(tri(0.5, 0.5, 2.5, 8)).toBe(0);
    expect(tri(8, 0.5, 2.5, 8)).toBe(0);
  });
});

describe("computeScores", () => {
  const ctx = { positionUsd: 50, solChange24hPct: 3 };

  it("is deterministic: identical inputs produce identical outputs", () => {
    const a = computeScores(baseFeatures(), cleanRisk, ctx);
    const b = computeScores(baseFeatures(), cleanRisk, ctx);
    expect(a).toEqual(b);
  });

  it("gives an ideal healthy token a high opportunity score and low risk", () => {
    const s = computeScores(baseFeatures(), cleanRisk, ctx);
    expect(s.opportunityScore).toBeGreaterThan(65);
    expect(s.riskScore).toBeLessThan(30);
    expect(s.confidence).toBe(1);
  });

  it("penalizes active mint authority via contract risk", () => {
    const s = computeScores(baseFeatures({ mintAuthorityActive: true }), cleanRisk, ctx);
    expect(s.contractRisk.score).toBeGreaterThanOrEqual(40);
    const clean = computeScores(baseFeatures(), cleanRisk, ctx);
    expect(s.opportunityScore).toBeLessThan(clean.opportunityScore);
  });

  it("reduces confidence when data gaps exist", () => {
    const s = computeScores(
      baseFeatures({ holders: null, top10Pct: null, dataGaps: ["holders", "top10", "lp"] }),
      cleanRisk,
      ctx,
    );
    expect(s.confidence).toBeLessThan(1);
  });

  it("penalizes a late vertical pump in momentum", () => {
    const early = computeScores(baseFeatures(), cleanRisk, ctx);
    const late = computeScores(
      baseFeatures({ priceChange24h: 800, priceChange1h: 200 }),
      cleanRisk,
      ctx,
    );
    expect(late.momentum.score).toBeLessThan(early.momentum.score);
  });

  it("every component carries an explanation with its inputs", () => {
    const s = computeScores(baseFeatures(), cleanRisk, ctx);
    for (const c of [s.momentum, s.liquidity, s.holderQuality, s.contractRisk]) {
      expect(c.explanation.length).toBeGreaterThan(10);
      expect(Object.keys(c.inputs).length).toBeGreaterThan(0);
    }
  });
});

describe("NaN safety (regression: PrismaClientValidationError)", () => {
  const ctx = { positionUsd: 50, solChange24hPct: 3 };

  it("keeps persisted floats finite even when a NaN sneaks into features", () => {
    const dirty = baseFeatures();
    // Simulate an unguarded parseFloat leaking NaN into a feature.
    (dirty as unknown as Record<string, number>).sellImpactPct = NaN;
    (dirty as unknown as Record<string, number>).volAccel = NaN;
    const s = computeScores(dirty, cleanRisk, ctx);
    expect(Number.isFinite(s.opportunityScore)).toBe(true);
    expect(Number.isFinite(s.riskScore)).toBe(true);
    expect(Number.isFinite(s.confidence)).toBe(true);
  });
});
