import type { MarketSnapshot } from "../types";
import type { MarketDataProvider } from "./types";
import { fetchJson } from "./http";

// DexScreener public API (no key). Rate limit 300 req/min for /latest/dex.
// Docs: https://docs.dexscreener.com/api/reference

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

  async getMarketSnapshot(mint: string): Promise<MarketSnapshot | null> {
    const json = await fetchJson<{ pairs: DsPair[] | null }>(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { source: this.name, minIntervalMs: 250 },
    );
    const pairs = (json.pairs ?? []).filter((p) => p.chainId === "solana");
    if (pairs.length === 0) return null;
    // Use the deepest pool as the canonical market.
    const best = pairs.reduce((a, b) =>
      (a.liquidity?.usd ?? 0) >= (b.liquidity?.usd ?? 0) ? a : b,
    );
    const errors: string[] = [];
    if (best.priceUsd == null) errors.push("priceUsd missing");
    if (best.liquidity?.usd == null) errors.push("liquidity missing");
    return {
      source: this.name,
      dataMode: "live",
      observedAt: new Date(), // DexScreener serves near-real-time state
      priceUsd: best.priceUsd ? parseFloat(best.priceUsd) : undefined,
      liquidityUsd: best.liquidity?.usd,
      fdvUsd: best.fdv,
      marketCapUsd: best.marketCap,
      volume5mUsd: best.volume?.m5,
      volume1hUsd: best.volume?.h1,
      volume24hUsd: best.volume?.h24,
      buys5m: best.txns?.m5?.buys,
      sells5m: best.txns?.m5?.sells,
      buys1h: best.txns?.h1?.buys,
      sells1h: best.txns?.h1?.sells,
      priceChange5m: best.priceChange?.m5,
      priceChange1h: best.priceChange?.h1,
      priceChange24h: best.priceChange?.h24,
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
