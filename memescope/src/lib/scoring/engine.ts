import type {
  ContractRiskReport,
  FeatureVector,
  ScoreBreakdown,
  ScoreComponent,
} from "../types";
import {
  contractRiskScore,
  exitLiquidityRiskScore,
  manipulationRiskScore,
} from "../risk/engine";

// Transparent Meme Opportunity Score (0..100).
// Every component is a documented, deterministic function of observed features.
// No randomness anywhere. Formulas are duplicated in docs/SCORING_MODEL.md —
// keep both in sync.
//
// IMPORTANT HONESTY NOTE: weights below are initial heuristics chosen by
// reasoning, NOT validated by out-of-sample backtest yet. Until the research
// stage (docs/BACKTEST_METHODOLOGY.md) confirms an edge, scores rank relative
// attractiveness — they are not a profitability claim.

/** Piecewise-linear ramp: 0 at lo, 100 at hi (clamped). */
export function ramp(v: number, lo: number, hi: number): number {
  if (hi === lo) return v >= hi ? 100 : 0;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}

/** Triangle: 100 at peak, falling to 0 at lo/hi ends. */
export function tri(v: number, lo: number, peak: number, hi: number): number {
  if (v <= lo || v >= hi) return 0;
  return v <= peak ? ramp(v, lo, peak) : 100 - ramp(v, peak, hi);
}

function component(
  name: string,
  weight: number,
  parts: { label: string; value: number | null; score: number | null; formula: string }[],
): ScoreComponent {
  // Non-finite part scores are treated as "no data" — NaN must never reach the DB.
  const known = parts.filter((p) => p.score != null && Number.isFinite(p.score));
  const score =
    known.length === 0
      ? 0
      : known.reduce((s, p) => s + (p.score as number), 0) / known.length;
  const explanation = parts
    .map((p) =>
      p.score == null
        ? `${p.label}: нет данных (${p.formula})`
        : `${p.label}=${fmt(p.value)} → ${Math.round(p.score)}/100 (${p.formula})`,
    )
    .join("; ");
  const inputs: Record<string, number | string | boolean | null> = {};
  for (const p of parts) inputs[p.label] = p.value;
  return { name, score, weight, explanation, inputs };
}

function fmt(v: number | null): string {
  if (v == null) return "null";
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-US");
  return v.toFixed(2);
}

export interface ScoreContext {
  positionUsd: number;
  /** SOL 24h change %, used as market-regime proxy; null = unknown. */
  solChange24hPct: number | null;
}

export function computeScores(
  f: FeatureVector,
  risk: ContractRiskReport | null,
  ctx: ScoreContext,
): ScoreBreakdown {
  const momentum = component("Momentum", 0.3, [
    {
      label: "volAccel",
      value: f.volAccel,
      score: f.volAccel == null ? null : tri(f.volAccel, 0.5, 2.5, 8),
      formula: "tri(x; 0.5, 2.5, 8): ускорение объёма без вертикального перегрева",
    },
    {
      label: "buySellRatio1h",
      value: f.buySellRatio1h,
      score: f.buySellRatio1h == null ? null : tri(f.buySellRatio1h, 0.8, 1.8, 5),
      formula: "tri(x; 0.8, 1.8, 5): перевес покупателей, но не аномальный",
    },
    {
      label: "priceChange1h",
      value: f.priceChange1h,
      score: f.priceChange1h == null ? null : tri(f.priceChange1h, -20, 25, 150),
      formula: "tri(x%; -20, 25, 150): рост есть, финальная фаза пампа штрафуется",
    },
    {
      label: "priceChange24h",
      value: f.priceChange24h,
      score: f.priceChange24h == null ? null : tri(f.priceChange24h, -50, 80, 500),
      formula: "tri(x%; -50, 80, 500): >500% за сутки = вероятно поздно",
    },
  ]);

  const liquidity = component("Liquidity", 0.2, [
    {
      label: "liquidityUsd",
      value: f.liquidityUsd,
      score: f.liquidityUsd == null ? null : ramp(Math.log10(Math.max(1, f.liquidityUsd)), 4, 5.7),
      formula: "ramp(log10(liq); 4, 5.7): $10k → 0, $500k → 100",
    },
    {
      label: "volToLiq",
      value: f.volToLiq,
      score: f.volToLiq == null ? null : tri(f.volToLiq, 0.2, 4, 30),
      formula: "tri(x; 0.2, 4, 30): здоровый оборот, экстремум = wash-trading",
    },
    {
      label: "sellImpactPct",
      value: f.sellImpactPct,
      score: f.sellImpactPct == null ? null : 100 - ramp(f.sellImpactPct, 0.5, 8),
      formula: "100−ramp(impact%; 0.5, 8): меньше проскальзывание — лучше",
    },
  ]);

  const holderQuality = component("Holder Quality", 0.2, [
    {
      label: "holders",
      value: f.holders,
      score: f.holders == null ? null : ramp(Math.log10(Math.max(1, f.holders)), 2, 3.7),
      formula: "ramp(log10(holders); 2, 3.7): 100 → 0, 5000 → 100",
    },
    {
      label: "top10Pct",
      value: f.top10Pct,
      score: f.top10Pct == null ? null : 100 - ramp(f.top10Pct, 15, 60),
      formula: "100−ramp(top10%; 15, 60): концентрация штрафуется",
    },
    {
      label: "lpLockedPct",
      value: f.lpLockedPct,
      score: f.lpLockedPct == null ? null : ramp(f.lpLockedPct, 0, 100),
      formula: "ramp(x%; 0, 100): доля заблокированной/сожжённой ликвидности",
    },
  ]);

  // MVP honesty: without official social APIs we only observe presence of
  // site/socials from market metadata. Полный social-модуль — в ROADMAP.
  const socialNarrative = component("Social/Narrative", 0.1, [
    {
      label: "hasSocials",
      value: f.hasSocials ? 1 : 0,
      score: f.hasSocials ? 60 : 20,
      formula: "наличие сайта/соцсетей = 60, отсутствие = 20 (MVP-заглушка, см. ROADMAP)",
    },
  ]);

  const marketRegime = component("Market Regime", 0.2, [
    {
      label: "solChange24hPct",
      value: ctx.solChange24hPct,
      score: ctx.solChange24hPct == null ? null : tri(ctx.solChange24hPct, -12, 3, 25),
      formula: "tri(SOL 24h %; -12, 3, 25): спокойный рост SOL благоприятен, обвал/эйфория — нет",
    },
  ]);

  const contractRisk: ScoreComponent = {
    name: "Contract Risk",
    score: contractRiskScore(f, risk),
    weight: 0.4,
    explanation:
      "40×mintAuth + 40×freezeAuth + 0.25×(100−lpLocked%) + 7×dangerFlags (cap 100); rugged → 100",
    inputs: {
      mintAuthorityActive: f.mintAuthorityActive,
      freezeAuthorityActive: f.freezeAuthorityActive,
      lpLockedPct: f.lpLockedPct,
      rugged: f.rugged,
    },
  };

  const manipulationRisk: ScoreComponent = {
    name: "Manipulation Risk",
    score: manipulationRiskScore(f),
    weight: 0.3,
    explanation:
      "штраф за vol/liq>20, идеальную симметрию buy/sell, top10>30%, рост >300%/24ч (cap 100)",
    inputs: {
      volToLiq: f.volToLiq,
      buySellRatio1h: f.buySellRatio1h,
      top10Pct: f.top10Pct,
      priceChange24h: f.priceChange24h,
    },
  };

  const exitLiquidityRisk: ScoreComponent = {
    name: "Exit Liquidity Risk",
    score: exitLiquidityRiskScore(f, ctx.positionUsd),
    weight: 0.3,
    explanation:
      "10×(позиция как % пула) + 5×sellImpact% + штраф FDV/liq>50 (cap 100); нет данных о ликвидности → 80",
    inputs: {
      liquidityUsd: f.liquidityUsd,
      positionUsd: ctx.positionUsd,
      sellImpactPct: f.sellImpactPct,
      fdvToLiq: f.fdvToLiq,
    },
  };

  const oppComponents = [momentum, liquidity, holderQuality, socialNarrative, marketRegime];
  const oppWeightSum = oppComponents.reduce((s, c) => s + c.weight, 0);
  const opportunityScoreRaw =
    oppComponents.reduce((s, c) => s + c.score * c.weight, 0) / oppWeightSum;

  const riskComponents = [contractRisk, manipulationRisk, exitLiquidityRisk];
  const riskWeightSum = riskComponents.reduce((s, c) => s + c.weight, 0);
  const riskScore =
    riskComponents.reduce((s, c) => s + c.score * c.weight, 0) / riskWeightSum;

  // Risk discounts opportunity: MOS = opp × (1 − 0.6 × risk/100).
  const opportunityScore = opportunityScoreRaw * (1 - 0.6 * (riskScore / 100));

  // Confidence: 1 minus penalty per missing input group (cap at 0.9 penalty).
  const confidence = Math.max(0.1, 1 - Math.min(0.9, f.dataGaps.length * 0.12));

  // Last line of defense: the three persisted floats must be finite.
  const safe = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

  return {
    opportunityScore: safe(opportunityScore, 0),
    riskScore: safe(riskScore, 100),
    confidence: safe(confidence, 0.1),
    momentum,
    liquidity,
    holderQuality,
    socialNarrative,
    marketRegime,
    contractRisk,
    manipulationRisk,
    exitLiquidityRisk,
  };
}
