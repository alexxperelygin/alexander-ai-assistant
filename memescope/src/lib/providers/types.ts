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
  /**
   * Сеть ОБЯЗАТЕЛЬНА. Раньше параметр был необязательным, а в реализации стоял
   * `chain = "solana"` — и монитор позиций, забывший его передать, молча
   * получал null по каждому токену в base, bsc, ethereum и arbitrum: внутри
   * ответ фильтруется по chainId. Ошибка компилировалась и не падала, просто
   * половина портфеля переставала получать прямую цену. Необязательный
   * параметр со значением по умолчанию — это ровно та форма, в которой такая
   * ошибка не видна ни компилятору, ни тестам.
   */
  getMarketSnapshot(mint: string, chain: string): Promise<MarketSnapshot | null>;
  /**
   * То же самое, но пачкой. Нужен не для скорости кода, а чтобы не упираться в
   * лимит источника: 24 августа монитор при 39 открытых позициях и опросе раз
   * в 30 секунд съедал 78 запросов в минуту из 240 доступных, сканер добирал
   * остальное, и очередь вставала в собственный троттлинг. Процессор при этом
   * простаивал, а цены по трети позиций устаревали, и трейлинг-стоп по ним
   * переставал считаться.
   *
   * Метод необязательный: провайдер, который не умеет пачками, просто его не
   * объявляет, и вызывающий сам сходит по одному.
   */
  getMarketSnapshots?(
    tokens: { mint: string; chain: string }[],
  ): Promise<Map<string, MarketSnapshot | null>>;
}

/** Ключ в карте, которую возвращает getMarketSnapshots. */
export function marketKey(mint: string, chain: string): string {
  return `${chain}:${mint}`;
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
