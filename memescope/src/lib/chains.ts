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
}

export const CHAINS: Record<string, ChainConfig> = {
  solana: {
    id: "solana", label: "Solana", geckoNetwork: "solana",
    hasRiskProvider: true, hasRouteProvider: true,
  },
  base: {
    id: "base", label: "Base", geckoNetwork: "base", goplusChainId: "8453",
    hasRiskProvider: true, hasRouteProvider: false,
  },
  bsc: {
    id: "bsc", label: "BNB Chain", geckoNetwork: "bsc", goplusChainId: "56",
    hasRiskProvider: true, hasRouteProvider: false,
  },
  ethereum: {
    id: "ethereum", label: "Ethereum", geckoNetwork: "eth", goplusChainId: "1",
    hasRiskProvider: true, hasRouteProvider: false,
  },
  arbitrum: {
    id: "arbitrum", label: "Arbitrum", geckoNetwork: "arbitrum", goplusChainId: "42161",
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
