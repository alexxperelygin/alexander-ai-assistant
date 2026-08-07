import { config } from "../config";
import type { ContractRiskReport } from "../types";
import type {
  DiscoveryProvider,
  MarketDataProvider,
  RiskProvider,
  RouteProvider,
  SocialProvider,
} from "./types";
import { GeckoTerminalDiscovery } from "./geckoterminal";
import { DexScreenerMarketData } from "./dexscreener";
import { RugCheckRisk } from "./rugcheck";
import { GoPlusRisk } from "./goplus";
import { chainConfig, DEFAULT_CHAIN } from "../chains";
import { JupiterRoutes } from "./jupiter";
import { XSocial } from "./x";
import { RedditSocial } from "./reddit";
import { FarcasterSocial } from "./farcaster";
import { MockProvider } from "./mock";

export interface ProviderSet {
  dataMode: "live" | "mock";
  discovery: DiscoveryProvider;
  market: MarketDataProvider;
  risk: RiskProvider;
  routes: RouteProvider;
  /** Только настроенные источники. Пустой список = социальных данных нет. */
  socials: SocialProvider[];
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
    return { dataMode: "mock", discovery: mock, market: mock, risk: mock, routes: mock, socials: [] };
  }
  // Каждый источник включается своим ключом независимо: отсутствие одного не
  // мешает остальным. SOCIAL_SOURCES дополнительно ограничивает список.
  //
  // Farcaster выключен по умолчанию НЕ из-за поломки. За сутки: 527 запросов,
  // 1732 прочитанных поста, 0 упоминаний. Диагностика подтвердила, что тексты
  // у постов есть — значит адреса контрактов там просто не обсуждают. Признак,
  // который всегда равен нулю, не может ничего предсказывать: у константы нет
  // информации. Платить за неё пятью сотнями запросов в сутки незачем.
  // Включается обратно через SOCIAL_SOURCES=x,farcaster.
  const enabled = (process.env.SOCIAL_SOURCES ?? "x,reddit")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const socials = [new XSocial(), new RedditSocial(), new FarcasterSocial()].filter(
    (p) => enabled.includes(p.name) && p.isConfigured(),
  );
  return {
    dataMode: "live",
    discovery: new GeckoTerminalDiscovery(),
    market: new DexScreenerMarketData(),
    risk: new ChainRoutedRisk(),
    routes: new JupiterRoutes(),
    socials,
  };
}
