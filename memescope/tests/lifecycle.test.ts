import { describe, expect, it } from "vitest";
import { buildTradePlan, decideStatus, HYSTERESIS_POINTS, READY_SCORE } from "../src/lib/strategy/lifecycle";
import { FROZEN_EXIT } from "../src/lib/paper/exit-policy";
import { DEFAULT_RISK_SETTINGS, type FeatureVector, type ScoreBreakdown } from "../src/lib/types";

function features(): FeatureVector {
  return {
    computedAt: new Date(),
    tokenAgeMin: 120, priceUsd: 0.0001, liquidityUsd: 80_000, fdvUsd: 900_000,
    marketCapUsd: 800_000, volume1hUsd: 60_000, volume24hUsd: 300_000, volAccel: 2,
    buySellRatio1h: 1.5, txns1h: 400, priceChange1h: 20, priceChange24h: 60,
    volToLiq: 4, fdvToLiq: 11, holders: 1000, top10Pct: 25, lpLockedPct: 100,
    mintAuthorityActive: false, freezeAuthorityActive: false, rugged: false,
    sellRouteOk: true, sellImpactPct: 1, liqTrendPct: 0,
    hasSocials: true, dataGaps: [],
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

describe("frozen exit policy (docs/PREREGISTRATION.md)", () => {
  // Эти проверки существуют ради одной ошибки: тихо вернуть лесенку тейков.
  // Измерение показало, что частичные фиксации на 1.5x и 2x обрубают правый
  // хвост и уводят результат с +26% к +8.5%, а на выборке без фильтра
  // ликвидности — в минус. Возврат лесенки не сломает ни один другой тест,
  // поэтому ловим его здесь.
  it("plan sells nothing early: the take-profit ladder is gone", () => {
    const plan = buildTradePlan({
      features: features(), settings: DEFAULT_RISK_SETTINGS,
      symbol: "TEST", mint: "So11111111111111111111111111111111111111112",
    });
    expect(plan).not.toBeNull();
    expect(plan!.takeProfitLevels).toEqual([]);
    expect(plan!.stopCondition).toContain("−20%");
    expect(plan!.stopCondition).toContain("30%");
  });

  it("keeps the frozen numbers the report and the portfolio share", () => {
    // Отчёт и живой портфель считают одно и то же только пока константа одна.
    expect(FROZEN_EXIT.stopPct).toBeCloseTo(0.2);
    expect(FROZEN_EXIT.trailPct).toBeCloseTo(0.3);
    expect(FROZEN_EXIT.liquidityFloorRatio).toBeCloseTo(0.6);
    expect(FROZEN_EXIT.maxHoldMin).toBe(3 * 24 * 60);
  });
});
