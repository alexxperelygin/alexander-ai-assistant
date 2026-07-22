import type { ContractRiskReport, FeatureVector, MarketSnapshot, RouteQuote } from "../types";

// Turns raw provider payloads into the feature vector used by risk/scoring.
// Rule: a feature is either derived from observed data or null. Missing inputs
// are listed in dataGaps and lower confidence downstream — they are never
// silently replaced with invented values.

export interface FeatureInputs {
  snapshot: MarketSnapshot | null;
  risk: ContractRiskReport | null;
  sellQuote: RouteQuote | null;
  pairCreatedAt: Date | null;
  hasSocials: boolean;
  now?: Date;
}

export function computeFeatures(inp: FeatureInputs): FeatureVector {
  const now = inp.now ?? new Date();
  const s = inp.snapshot;
  const r = inp.risk;
  const gaps: string[] = [];

  const num = (v: number | undefined | null, name: string): number | null => {
    if (v == null || !Number.isFinite(v)) {
      gaps.push(name);
      return null;
    }
    return v;
  };

  if (!s) gaps.push("market-snapshot");
  if (!r) gaps.push("risk-report");
  if (!inp.sellQuote) gaps.push("sell-quote");

  const tokenAgeMin = inp.pairCreatedAt
    ? Math.max(0, (now.getTime() - inp.pairCreatedAt.getTime()) / 60_000)
    : (gaps.push("pair-created-at"), null);

  const vol5m = s?.volume5mUsd ?? null;
  const vol1h = s?.volume1hUsd ?? null;
  // Volume acceleration: annualize 5m window vs 1h window. >1 = accelerating.
  const volAccel =
    vol5m != null && vol1h != null && vol1h > 0 ? (vol5m * 12) / vol1h : null;
  if (volAccel === null) gaps.push("vol-accel");

  const buys1h = s?.buys1h ?? null;
  const sells1h = s?.sells1h ?? null;
  const buySellRatio1h =
    buys1h != null && sells1h != null ? buys1h / Math.max(sells1h, 1) : null;
  if (buySellRatio1h === null) gaps.push("buy-sell-ratio");

  const liquidityUsd = s ? num(s.liquidityUsd, "liquidity") : null;
  const volume24hUsd = s ? num(s.volume24hUsd, "volume24h") : null;
  const fdvUsd = s?.fdvUsd ?? null;

  return {
    computedAt: now,
    tokenAgeMin,
    priceUsd: s ? num(s.priceUsd, "price") : null,
    liquidityUsd,
    fdvUsd,
    marketCapUsd: s?.marketCapUsd ?? null,
    volume1hUsd: vol1h,
    volume24hUsd,
    volAccel,
    buySellRatio1h,
    txns1h: buys1h != null && sells1h != null ? buys1h + sells1h : null,
    priceChange1h: s?.priceChange1h ?? null,
    priceChange24h: s?.priceChange24h ?? null,
    volToLiq:
      volume24hUsd != null && liquidityUsd != null && liquidityUsd > 0
        ? volume24hUsd / liquidityUsd
        : null,
    fdvToLiq:
      fdvUsd != null && liquidityUsd != null && liquidityUsd > 0
        ? fdvUsd / liquidityUsd
        : null,
    holders: s?.holders ?? null,
    top10Pct: r?.top10Pct ?? null,
    lpLockedPct: r?.lpLockedPct ?? null,
    mintAuthorityActive: r?.mintAuthority ?? null,
    freezeAuthorityActive: r?.freezeAuthority ?? null,
    rugged: r?.rugged ?? null,
    sellRouteOk: inp.sellQuote ? inp.sellQuote.routeFound : (r?.sellRouteOk ?? null),
    sellImpactPct: inp.sellQuote?.priceImpactPct ?? r?.sellImpactPct ?? null,
    hasSocials: inp.hasSocials,
    dataGaps: [...new Set(gaps)],
  };
}
