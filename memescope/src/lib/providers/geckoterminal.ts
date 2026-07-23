import type { DiscoveredToken } from "../types";
import type { DiscoveryProvider } from "./types";
import { fetchJson } from "./http";

// GeckoTerminal public API (no key). Rate limit ~30 calls/min.
// Docs: https://www.geckoterminal.com/dex-api

interface GtPool {
  id: string;
  attributes: {
    address: string;
    name: string;
    pool_created_at: string | null;
    reserve_in_usd?: string;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
}

export class GeckoTerminalDiscovery implements DiscoveryProvider {
  readonly name = "geckoterminal";

  async discoverNewTokens(): Promise<DiscoveredToken[]> {
    const json = await fetchJson<{ data: GtPool[] }>(
      "https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1",
      { source: this.name, minIntervalMs: 2100 },
    );
    const out: DiscoveredToken[] = [];
    for (const pool of json.data ?? []) {
      const baseId = pool.relationships?.base_token?.data?.id ?? "";
      const mint = baseId.startsWith("solana_") ? baseId.slice("solana_".length) : null;
      if (!mint) continue;
      const [symbol] = (pool.attributes.name ?? "?").split(" / ");
      out.push({
        chain: "solana",
        mint,
        symbol: (symbol ?? "?").trim() || "?",
        name: (symbol ?? "?").trim() || "?",
        pairAddress: pool.attributes.address,
        dex: pool.relationships?.dex?.data?.id,
        pairCreatedAt: pool.attributes.pool_created_at
          ? new Date(pool.attributes.pool_created_at)
          : undefined,
      });
    }
    return out;
  }
}
