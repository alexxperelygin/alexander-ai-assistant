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
  /** Current market state for a token (by mint). Null = token not found. */
  getMarketSnapshot(mint: string): Promise<MarketSnapshot | null>;
}

export interface RiskProvider {
  readonly name: string;
  getRiskReport(mint: string): Promise<ContractRiskReport | null>;
}

export interface RouteProvider {
  readonly name: string;
  /** Simulated quote through the aggregator; sell direction verifies exit is possible. */
  getQuote(mint: string, direction: "buy" | "sell", amountUsd: number): Promise<RouteQuote | null>;
}
