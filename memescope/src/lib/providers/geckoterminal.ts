import type { DiscoveredToken } from "../types";
import type { DiscoveryProvider } from "./types";
import { fetchJson } from "./http";
import { enabledChains } from "../chains";

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
    // Один запрос на сеть за цикл. Лимит GeckoTerminal ~30 вызовов в минуту,
    // поэтому пять сетей помещаются с запасом; ошибка одной сети не должна
    // лишать данных остальные.
    const out: DiscoveredToken[] = [];
    for (const chain of enabledChains()) {
      try {
        out.push(...(await this.discoverOnChain(chain.id, chain.geckoNetwork)));
      } catch {
        // Сеть недоступна — пропускаем её в этом цикле, остальные продолжают.
      }
    }
    return out;
  }

  private async discoverOnChain(chainId: string, geckoNetwork: string): Promise<DiscoveredToken[]> {
    const json = await fetchJson<{ data: GtPool[] }>(
      `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/new_pools?page=1`,
      {
        source: `${this.name}:${geckoNetwork}`,
        // Лимит GeckoTerminal — общий на весь API, а не на сеть.
        throttleKey: this.name,
        minIntervalMs: 2500,
      },
    );
    const out: DiscoveredToken[] = [];
    const prefix = `${geckoNetwork}_`;
    for (const pool of json.data ?? []) {
      const baseId = pool.relationships?.base_token?.data?.id ?? "";
      const mint = baseId.startsWith(prefix) ? baseId.slice(prefix.length) : null;
      if (!mint) continue;
      const [symbol] = (pool.attributes.name ?? "?").split(" / ");
      out.push({
        chain: chainId,
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
