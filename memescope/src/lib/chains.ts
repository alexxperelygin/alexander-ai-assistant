// Реестр поддерживаемых сетей.
//
// Идентификатор сети совпадает с chainId в DexScreener — он же хранится в
// Token.chain и служит внутренним ключом. Для GeckoTerminal нужен собственный
// код сети, поэтому маппинг явный.
//
// Ключевое различие между сетями — не котировки (DexScreener и GeckoTerminal
// покрывают все), а ПРОВЕРКИ БЕЗОПАСНОСТИ. Для Solana есть RugCheck (mint/freeze
// authority, концентрация, LP) и Jupiter (симуляция продажи = проверка на
// honeypot). Для EVM-сетей у нас таких источников пока нет. Поэтому сеть без
// risk-провайдера участвует в сборе данных и исследовании, но НЕ МОЖЕТ выдать
// торговый сигнал: покупать токен, у которого не проверен даже контракт, —
// это ровно тот риск, ради снятия которого система и писалась.

export interface ChainConfig {
  /** Внутренний id = chainId в DexScreener. */
  id: string;
  label: string;
  /** Код сети в GeckoTerminal (может отличаться от id). */
  geckoNetwork: string;
  /** Есть ли источник контрактных рисков (mint/freeze authority, honeypot, LP). */
  hasRiskProvider: boolean;
  /** Числовой id сети в GoPlus Security (только EVM). */
  goplusChainId?: string;
  /** Есть ли агрегатор для симуляции продажи. */
  hasRouteProvider: boolean;
  /**
   * Публичный JSON-RPC для чтения состояния пула напрямую из блокчейна.
   * Нужен там, где котировочный источник молчит: цена и ликвидность из
   * резервов пула — это первичные данные, а не чей-то пересказ.
   * Пусто = сеть читать не умеем, работает прежний путь.
   */
  rpcUrl?: string;
  /**
   * Обёрнутая нативная монета сети и её символ в котировках. Нужна, чтобы
   * перевести цену токена из единиц второй стороны пары в доллары.
   */
  wrappedNative?: { address: string; symbol: string };
}

export const CHAINS: Record<string, ChainConfig> = {
  solana: {
    id: "solana", label: "Solana", geckoNetwork: "solana",
    hasRiskProvider: true, hasRouteProvider: true,
  },
  base: {
    id: "base", label: "Base", geckoNetwork: "base", goplusChainId: "8453",
    hasRiskProvider: true, hasRouteProvider: false,
    rpcUrl: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
    wrappedNative: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH" },
  },
  bsc: {
    id: "bsc", label: "BNB Chain", geckoNetwork: "bsc", goplusChainId: "56",
    hasRiskProvider: true, hasRouteProvider: false,
    rpcUrl: process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org",
    wrappedNative: { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB" },
  },
  ethereum: {
    id: "ethereum", label: "Ethereum", geckoNetwork: "eth", goplusChainId: "1",
    hasRiskProvider: true, hasRouteProvider: false,
    rpcUrl: process.env.ETH_RPC_URL ?? "https://ethereum-rpc.publicnode.com",
    wrappedNative: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH" },
  },
  arbitrum: {
    id: "arbitrum", label: "Arbitrum", geckoNetwork: "arbitrum", goplusChainId: "42161",
    hasRiskProvider: true, hasRouteProvider: false,
    rpcUrl: process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc",
    wrappedNative: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH" },
  },
  // L2 от Robinhood. Проверено на живых данных 6 августа: ~20 новых пулов в
  // минуту и мем-токены с оборотом $10–20M за сутки, то есть это не витрина, а
  // работающий рынок. GeckoTerminal и DexScreener индексируют её как
  // "robinhood", GoPlus знает как сеть 4663.
  robinhood: {
    id: "robinhood", label: "Robinhood Chain", geckoNetwork: "robinhood", goplusChainId: "4663",
    hasRiskProvider: true, hasRouteProvider: false,
  },
};

export const DEFAULT_CHAIN = "solana";

export function chainConfig(chain: string): ChainConfig | null {
  return CHAINS[chain] ?? null;
}

/** Может ли сеть в принципе выдать торговый сигнал (а не только данные). */
export function chainCanSignal(chain: string): boolean {
  const c = chainConfig(chain);
  return c != null && c.hasRiskProvider;
}

/**
 * Сети, которые сканируются. Задаётся через SCAN_CHAINS (список через запятую),
 * по умолчанию — все известные. Неизвестные значения игнорируются, чтобы опечатка
 * в переменной окружения не уронила воркер.
 */
export function enabledChains(raw = process.env.SCAN_CHAINS): ChainConfig[] {
  if (!raw?.trim()) return Object.values(CHAINS);
  const picked = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .map((id) => CHAINS[id])
    .filter((c): c is ChainConfig => c != null);
  return picked.length ? picked : [CHAINS[DEFAULT_CHAIN] as ChainConfig];
}
