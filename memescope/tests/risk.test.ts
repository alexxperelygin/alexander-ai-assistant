import { describe, expect, it } from "vitest";
import { evaluateHardRejections } from "../src/lib/risk/engine";
import { DEFAULT_RISK_SETTINGS, type FeatureVector } from "../src/lib/types";

function features(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    computedAt: new Date(),
    tokenAgeMin: 120,
    priceUsd: 0.0001,
    liquidityUsd: 80_000,
    fdvUsd: 900_000,
    marketCapUsd: 800_000,
    volume1hUsd: 60_000,
    volume24hUsd: 300_000,
    volAccel: 2,
    buySellRatio1h: 1.5,
    txns1h: 400,
    priceChange1h: 20,
    priceChange24h: 60,
    volToLiq: 4,
    fdvToLiq: 11,
    holders: 1000,
    top10Pct: 25,
    lpLockedPct: 100,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    rugged: false,
    sellRouteOk: true,
    sellImpactPct: 1,
    hasSocials: true,
    dataGaps: [],
    ...overrides,
  };
}

const S = DEFAULT_RISK_SETTINGS;
const rules = (f: FeatureVector) => evaluateHardRejections(f, null, S).map((r) => r.rule);

describe("hard rejection rules", () => {
  it("passes a clean token", () => {
    expect(rules(features())).toEqual([]);
  });
  it("rejects when sell route is not confirmed (honeypot)", () => {
    expect(rules(features({ sellRouteOk: false }))).toContain("sell-not-confirmed");
  });
  it("rejects active mint and freeze authority", () => {
    expect(rules(features({ mintAuthorityActive: true }))).toContain("mint-authority");
    expect(rules(features({ freezeAuthorityActive: true }))).toContain("freeze-authority");
  });
  it("rejects rug-flagged tokens", () => {
    expect(rules(features({ rugged: true }))).toContain("rugged");
  });
  it("rejects excessive top-10 concentration", () => {
    expect(rules(features({ top10Pct: 75 }))).toContain("holder-concentration");
  });
  it("rejects insufficient liquidity", () => {
    expect(rules(features({ liquidityUsd: 3_000 }))).toContain("insufficient-liquidity");
  });
  it("rejects slippage above limit", () => {
    expect(rules(features({ sellImpactPct: S.maxSlippagePct + 5 }))).toContain("slippage-exceeds-limit");
  });
  it("rejects tokens younger than the minimum age", () => {
    expect(rules(features({ tokenAgeMin: 2 }))).toContain("too-new");
  });
  it("flags suspected wash trading", () => {
    expect(rules(features({ volToLiq: 80, buySellRatio1h: 1.0 }))).toContain("suspected-wash-trading");
  });
  it("rejects when core data is missing", () => {
    expect(rules(features({ priceUsd: null, liquidityUsd: null }))).toContain("insufficient-data");
  });
});
