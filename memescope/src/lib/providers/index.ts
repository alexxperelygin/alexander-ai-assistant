import { config } from "../config";
import type { ContractRiskReport } from "../types";
import type {
  DiscoveryProvider,
  MarketDataProvider,
  RiskProvider,
  RouteProvider,
} from "./types";
import { GeckoTerminalDiscovery } from "./geckoterminal";
import { DexScreenerMarketData } from "./dexscreener";
import { RugCheckRisk } from "./rugcheck";
import { GoPlusRisk } from "./goplus";
import { chainConfig, DEFAULT_CHAIN } from "../chains";
import { JupiterRoutes } from "./jupiter";
import { MockProvider } from "./mock";

export interface ProviderSet {
  dataMode: "live" | "mock";
  discovery: DiscoveryProvider;
  market: MarketDataProvider;
  risk: RiskProvider;
  routes: RouteProvider;
}

/**
 * Проверка контракта зависит от сети: RugCheck понимает только Solana, GoPlus —
 * только EVM. Роутер выбирает источник по сети и честно возвращает null, если
 * подходящего нет, вместо того чтобы отдать «проверку», которой не было.
 */
class ChainRoutedRisk implements RiskProvider {
  readonly name = "chain-routed-risk";
  private readonly solana = new RugCheckRisk();
  private readonly evm = new GoPlusRisk();

  async getRiskReport(mint: string, chain = DEFAULT_CHAIN): Promise<ContractRiskReport | null> {
    const cfg = chainConfig(chain);
    if (!cfg) return null;
    if (cfg.id === "solana") return this.solana.getRiskReport(mint);
    if (cfg.goplusChainId) return this.evm.getRiskReport(mint, chain);
    return null;
  }
}

export function getProviders(): ProviderSet {
  if (config.dataMode === "mock") {
    const mock = new MockProvider();
    return { dataMode: "mock", discovery: mock, market: mock, risk: mock, routes: mock };
  }
  return {
    dataMode: "live",
    discovery: new GeckoTerminalDiscovery(),
    market: new DexScreenerMarketData(),
    risk: new ChainRoutedRisk(),
    routes: new JupiterRoutes(),
  };
}
