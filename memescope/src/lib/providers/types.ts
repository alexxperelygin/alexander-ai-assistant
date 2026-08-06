import type {
  ContractRiskReport,
  DiscoveredToken,
  MarketSnapshot,
  RouteQuote,
} from "../types";

// Every external source is wrapped in one of these adapter interfaces so it can
// be swapped (e.g. GeckoTerminal → Birdeye) without touching the engines.

export interface DiscoveryProvider {
  readonly name: string;
  /** Recently created pools / tokens on the target chain. */
  discoverNewTokens(): Promise<DiscoveredToken[]>;
}

export interface MarketDataProvider {
  readonly name: string;
  /** Current market state for a token (by mint/address on the given chain). Null = not found. */
  getMarketSnapshot(mint: string, chain?: string): Promise<MarketSnapshot | null>;
}

export interface RiskProvider {
  readonly name: string;
  getRiskReport(mint: string, chain?: string): Promise<ContractRiskReport | null>;
}

/** Социальный срез по токену (упоминания, авторы, охват, признаки накрутки). */
export interface SocialStats {
  source: string;
  dataMode: "live" | "mock";
  windowMin: number;
  /** Сколько постов реально прочитано — расход платного лимита. */
  postsRead: number;
  mentions: number | null;
  uniqueAuthors: number | null;
  reach: number | null;
  engagement: number | null;
  freshAccountShare: number | null;
  medianAuthorAgeDays: number | null;
  errors?: string[];
}

export interface SocialProvider {
  readonly name: string;
  /** Настроен ли источник (есть ключ). Без ключа система работает как раньше. */
  isConfigured(): boolean;
  /** query — обычно адрес контракта: он уникален, в отличие от тикера. */
  getSocialStats(query: string, windowMin?: number, now?: Date): Promise<SocialStats | null>;
}

export interface RouteProvider {
  readonly name: string;
  /** Simulated quote through the aggregator; sell direction verifies exit is possible. */
  getQuote(mint: string, direction: "buy" | "sell", amountUsd: number): Promise<RouteQuote | null>;
}
