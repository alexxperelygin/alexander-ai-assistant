import type { MarketSnapshot } from "../types";
import { marketKey, type MarketDataProvider } from "./types";
import { fetchJson } from "./http";

// DexScreener public API (no key). Rate limit 300 req/min for /latest/dex.
// Docs: https://docs.dexscreener.com/api/reference

/** Сколько адресов кладём в один запрос: предел эндпоинта — 30. */
const BATCH = 30;

interface DsPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { websites?: { url: string }[]; socials?: { type: string; url: string }[] };
}

export class DexScreenerMarketData implements MarketDataProvider {
  readonly name = "dexscreener";

  async getMarketSnapshot(mint: string, chain: string): Promise<MarketSnapshot | null> {
    const json = await fetchJson<{ pairs: DsPair[] | null }>(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { source: this.name, minIntervalMs: 250 },
    );
    return this.pick(json.pairs ?? [], mint, chain);
  }

  /**
   * Пачкой. Эндпоинт принимает до 30 адресов через запятую и возвращает пары
   * вперемешку, поэтому каждый токен выбирается из общего ответа своим
   * фильтром — ровно тем же, что и при одиночном запросе.
   *
   * Адрес сравнивается без учёта регистра: EVM-адреса приходят то в
   * checksum-виде, то строчными. Ключ карты при этом строится из ТОГО адреса,
   * который просили, иначе вызывающий не найдёт свою запись.
   */
  async getMarketSnapshots(
    tokens: { mint: string; chain: string }[],
  ): Promise<Map<string, MarketSnapshot | null>> {
    const out = new Map<string, MarketSnapshot | null>();
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      let pairs: DsPair[] = [];
      try {
        const json = await fetchJson<{ pairs: DsPair[] | null }>(
          `https://api.dexscreener.com/latest/dex/tokens/${chunk.map((t) => t.mint).join(",")}`,
          { source: this.name, minIntervalMs: 250 },
        );
        pairs = json.pairs ?? [];
      } catch {
        // Одна неудачная пачка не должна ронять весь цикл монитора: вызывающий
        // увидит отсутствие записи и сходит по этому токену отдельно.
        continue;
      }
      for (const t of chunk) out.set(marketKey(t.mint, t.chain), this.pick(pairs, t.mint, t.chain));
    }
    return out;
  }

  /** Выбор канонической пары по токену: та же логика для одиночного и пачки. */
  private pick(all: DsPair[], mint: string, chain: string): MarketSnapshot | null {
    const want = mint.toLowerCase();
    const pairs = all.filter(
      (p) => p.chainId === chain && p.baseToken.address.toLowerCase() === want,
    );
    if (pairs.length === 0) return null;
    // Use the deepest pool as the canonical market.
    const best = pairs.reduce((a, b) =>
      (a.liquidity?.usd ?? 0) >= (b.liquidity?.usd ?? 0) ? a : b,
    );
    const errors: string[] = [];
    if (best.priceUsd == null) errors.push("priceUsd missing");
    if (best.liquidity?.usd == null) errors.push("liquidity missing");
    // API values are untrusted: anything non-finite becomes undefined ("unknown").
    const fin = (v: number | undefined): number | undefined =>
      v != null && Number.isFinite(v) ? v : undefined;
    return {
      source: this.name,
      dataMode: "live",
      observedAt: new Date(), // DexScreener serves near-real-time state
      priceUsd: best.priceUsd ? fin(parseFloat(best.priceUsd)) : undefined,
      liquidityUsd: fin(best.liquidity?.usd),
      fdvUsd: fin(best.fdv),
      marketCapUsd: fin(best.marketCap),
      volume5mUsd: fin(best.volume?.m5),
      volume1hUsd: fin(best.volume?.h1),
      volume24hUsd: fin(best.volume?.h24),
      buys5m: fin(best.txns?.m5?.buys),
      sells5m: fin(best.txns?.m5?.sells),
      buys1h: fin(best.txns?.h1?.buys),
      sells1h: fin(best.txns?.h1?.sells),
      priceChange5m: fin(best.priceChange?.m5),
      priceChange1h: fin(best.priceChange?.h1),
      priceChange24h: fin(best.priceChange?.h24),
      raw: {
        pairAddress: best.pairAddress,
        dexId: best.dexId,
        pairCreatedAt: best.pairCreatedAt,
        symbol: best.baseToken.symbol,
        name: best.baseToken.name,
        websites: best.info?.websites?.map((w) => w.url),
        socials: best.info?.socials?.map((s) => `${s.type}:${s.url}`),
      },
      errors: errors.length ? errors : undefined,
    };
  }
}
