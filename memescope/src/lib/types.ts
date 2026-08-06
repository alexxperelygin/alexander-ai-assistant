// Core domain types shared by providers, engines, worker, API and UI.

export type DataMode = "live" | "mock";

export type OpportunityStatus =
  | "WATCH"
  | "CANDIDATE"
  | "READY"
  | "BUY"
  | "HOLD"
  | "TAKE_PROFIT"
  | "EXIT"
  | "INVALIDATED"
  | "AVOID"
  | "DATA_UNAVAILABLE";

export interface DiscoveredToken {
  chain: "solana";
  mint: string;
  symbol: string;
  name: string;
  pairAddress?: string;
  dex?: string;
  pairCreatedAt?: Date;
  website?: string;
  twitter?: string;
  telegram?: string;
}

export interface MarketSnapshot {
  source: string;
  dataMode: DataMode;
  observedAt: Date;
  priceUsd?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  marketCapUsd?: number;
  volume5mUsd?: number;
  volume1hUsd?: number;
  volume24hUsd?: number;
  buys5m?: number;
  sells5m?: number;
  buys1h?: number;
  sells1h?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  holders?: number;
  raw?: unknown;
  errors?: string[];
}

export interface RiskFlag {
  name: string;
  severity: "info" | "warning" | "danger" | "critical";
  description: string;
}

export interface ContractRiskReport {
  source: string;
  dataMode: DataMode;
  mintAuthority?: boolean; // true = still active (dangerous)
  freezeAuthority?: boolean;
  top10Pct?: number; // 0..100 share of supply held by top-10 non-LP holders
  insiderPct?: number;
  lpLockedPct?: number;
  rugged?: boolean;
  sellRouteOk?: boolean;
  sellImpactPct?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  flags: RiskFlag[];
  raw?: unknown;
}

export interface RouteQuote {
  source: string;
  dataMode: DataMode;
  direction: "buy" | "sell";
  inAmountUsd: number;
  priceImpactPct?: number; // 0..100
  routeFound: boolean;
  raw?: unknown;
}

// Feature vector computed from snapshots + risk report. Every field is either
// a real observed/derived value or null (never invented). Nulls degrade
// confidence and can trigger DATA_UNAVAILABLE.
export interface FeatureVector {
  computedAt: Date;
  tokenAgeMin: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  volume1hUsd: number | null;
  volume24hUsd: number | null;
  volAccel: number | null; // (5m vol * 12) / 1h vol — >1 means accelerating
  buySellRatio1h: number | null; // buys / max(sells,1)
  txns1h: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  volToLiq: number | null; // 24h volume / liquidity
  fdvToLiq: number | null; // FDV / liquidity — high = thin exit
  holders: number | null;
  top10Pct: number | null;
  lpLockedPct: number | null;
  mintAuthorityActive: boolean | null;
  freezeAuthorityActive: boolean | null;
  rugged: boolean | null;
  sellRouteOk: boolean | null;
  sellImpactPct: number | null;
  /** Изменение ликвидности с предыдущего наблюдения, % (null = не с чем сравнить). */
  liqTrendPct: number | null;
  hasSocials: boolean;
  dataGaps: string[]; // names of missing inputs
}

export interface ScoreComponent {
  name: string;
  score: number; // 0..100
  weight: number; // 0..1 within its group
  explanation: string; // formula and inputs, human-readable
  inputs: Record<string, number | string | boolean | null>;
}

export interface ScoreBreakdown {
  opportunityScore: number; // 0..100 Meme Opportunity Score
  riskScore: number; // 0..100, higher = riskier
  confidence: number; // 0..1, penalized by data gaps/staleness
  momentum: ScoreComponent;
  liquidity: ScoreComponent;
  holderQuality: ScoreComponent;
  socialNarrative: ScoreComponent;
  marketRegime: ScoreComponent;
  contractRisk: ScoreComponent;
  manipulationRisk: ScoreComponent;
  exitLiquidityRisk: ScoreComponent;
}

export interface RejectionHit {
  rule: string;
  description: string;
}

export interface TradePlan {
  entryLowUsd: number;
  entryHighUsd: number;
  maxSlippagePct: number;
  positionSizeUsd: number;
  maxPositionPctOfLiquidity: number;
  dexRoute: string; // e.g. "Jupiter aggregator (Raydium pool)"
  buyInstruction: string; // step-by-step manual buy instruction
  invalidation: string[]; // conditions that cancel entry
  stopCondition: string;
  takeProfitLevels: { multiple: number; sellFraction: number }[];
  fullExitCondition: string;
  validUntil: Date;
}

export interface RiskSettings {
  capitalUsd: number;
  maxRiskPerTradePct: number; // % of capital риск на сделку
  maxPositionUsd: number;
  maxTotalExposureUsd: number;
  dailyLossLimitUsd: number;
  cooldownAfterLosses: number; // consecutive losses before pause
  cooldownMinutes: number;
  maxSlippagePct: number;
  maxPositionPctOfLiquidity: number; // e.g. 1 = position ≤1% of pool liquidity
  minLiquidityUsd: number;
  minTokenAgeMin: number;
  maxTokenAgeMin: number;
  signalsPaused: boolean; // global kill switch for new signals
  liveTradingEnabled: boolean; // stage 1: always false
  paperTradingEnabled: boolean;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  capitalUsd: 1000,
  maxRiskPerTradePct: 1,
  maxPositionUsd: 50,
  maxTotalExposureUsd: 200,
  dailyLossLimitUsd: 50,
  cooldownAfterLosses: 3,
  cooldownMinutes: 120,
  maxSlippagePct: 3,
  maxPositionPctOfLiquidity: 1,
  // Raised 10k → 50k on evidence, not intuition. Once follow-up scanning made
  // outcomes measurable for dying tokens too, the unbiased 6h baseline for a
  // freshly scanned token turned out to be a median of −93.7% (13% profitable):
  // most new meme coins are micro-cap traps. Requiring >$50k liquidity moves
  // that median to −1.3%, i.e. the floor is what separates a coin flip from a
  // near-certain loss. Adjustable in Settings.
  minLiquidityUsd: 50_000,
  minTokenAgeMin: 20,
  maxTokenAgeMin: 7 * 24 * 60,
  signalsPaused: false,
  liveTradingEnabled: false,
  paperTradingEnabled: true,
};
