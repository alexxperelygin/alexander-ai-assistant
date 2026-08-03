import { describe, expect, it } from "vitest";
import { decideStatus, HYSTERESIS_POINTS, READY_SCORE } from "../src/lib/strategy/lifecycle";
import { DEFAULT_RISK_SETTINGS, type FeatureVector, type ScoreBreakdown } from "../src/lib/types";

function features(): FeatureVector {
  return {
    computedAt: new Date(),
    tokenAgeMin: 120, priceUsd: 0.0001, liquidityUsd: 80_000, fdvUsd: 900_000,
    marketCapUsd: 800_000, volume1hUsd: 60_000, volume24hUsd: 300_000, volAccel: 2,
    buySellRatio1h: 1.5, txns1h: 400, priceChange1h: 20, priceChange24h: 60,
    volToLiq: 4, fdvToLiq: 11, holders: 1000, top10Pct: 25, lpLockedPct: 100,
    mintAuthorityActive: false, freezeAuthorityActive: false, rugged: false,
    sellRouteOk: true, sellImpactPct: 1, hasSocials: true, dataGaps: [],
  };
}

function scoresAt(opportunityScore: number): ScoreBreakdown {
  const c = { name: "x", score: 50, weight: 1, explanation: "", inputs: {} };
  return {
    opportunityScore, riskScore: 10, confidence: 1,
    momentum: c, liquidity: c, holderQuality: c, socialNarrative: c,
    marketRegime: c, contractRisk: c, manipulationRisk: c, exitLiquidityRisk: c,
  };
}

describe("status hysteresis (anti-flapping)", () => {
  const S = DEFAULT_RISK_SETTINGS;

  it("fresh token needs the full READY threshold", () => {
    const d = decideStatus({ features: features(), scores: scoresAt(READY_SCORE - 1), rejections: [], settings: S });
    expect(d.status).toBe("CANDIDATE");
  });

  it("token already READY keeps READY within the hysteresis band", () => {
    const d = decideStatus({
      features: features(), scores: scoresAt(READY_SCORE - HYSTERESIS_POINTS + 1),
      rejections: [], settings: S, previousStatus: "READY",
    });
    expect(d.status).toBe("READY");
  });

  it("token already READY is demoted below the band", () => {
    const d = decideStatus({
      features: features(), scores: scoresAt(READY_SCORE - HYSTERESIS_POINTS - 1),
      rejections: [], settings: S, previousStatus: "READY",
    });
    expect(d.status).toBe("CANDIDATE");
  });
});
