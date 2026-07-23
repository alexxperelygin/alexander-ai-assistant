import { config } from "../config";
import type {
  DiscoveryProvider,
  MarketDataProvider,
  RiskProvider,
  RouteProvider,
} from "./types";
import { GeckoTerminalDiscovery } from "./geckoterminal";
import { DexScreenerMarketData } from "./dexscreener";
import { RugCheckRisk } from "./rugcheck";
import { JupiterRoutes } from "./jupiter";
import { MockProvider } from "./mock";

export interface ProviderSet {
  dataMode: "live" | "mock";
  discovery: DiscoveryProvider;
  market: MarketDataProvider;
  risk: RiskProvider;
  routes: RouteProvider;
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
    risk: new RugCheckRisk(),
    routes: new JupiterRoutes(),
  };
}
