import { describe, expect, it, vi } from "vitest";
import { roundRobinByChain } from "../src/lib/ingestion/scanner";

const t = (chain: string, n: number) => ({ chain, id: `${chain}-${n}` });

describe("roundRobinByChain", () => {
  it("stops one chain from taking the whole budget", () => {
    // Discovery приносит по ~20 пулов из каждой сети, а Solana ещё и постоянный
    // поток: без чередования весь бюджет ушёл бы одной сети.
    const flood = [...Array(50)].map((_, i) => t("base", i));
    const few = [t("solana", 0), t("solana", 1)];
    const picked = roundRobinByChain([...flood, ...few], 6);
    expect(picked.filter((x) => x.chain === "solana")).toHaveLength(2);
    expect(picked.filter((x) => x.chain === "base")).toHaveLength(4);
  });

  it("keeps the order inside each chain", () => {
    const picked = roundRobinByChain(
      [t("solana", 0), t("solana", 1), t("bsc", 0), t("bsc", 1)],
      4,
    );
    expect(picked.map((x) => x.id)).toEqual(["solana-0", "bsc-0", "solana-1", "bsc-1"]);
  });

  it("uses the remaining budget when a chain runs out", () => {
    const picked = roundRobinByChain([t("solana", 0), t("bsc", 0), t("bsc", 1)], 10);
    expect(picked).toHaveLength(3);
  });

  it("handles an empty input", () => {
    expect(roundRobinByChain([], 5)).toEqual([]);
  });
});

// --- Прямой запрос цены и сеть ---
//
// Регрессия, найденная 17 августа: монитор позиций вызывал getMarketSnapshot
// без сети. У провайдера параметр был необязательным со значением "solana", а
// внутри стоит фильтр по chainId — поэтому по каждой позиции в base, bsc,
// ethereum и arbitrum прямой запрос возвращал null. Ошибка компилировалась,
// тесты проходили, и половина портфеля тихо жила на запасном источнике, где
// трейлинг-стоп считается только пока снапшот свежее 30 минут.
describe("DexScreenerMarketData.getMarketSnapshot", () => {
  const pair = (chainId: string, priceUsd: string, liq: number) => ({
    chainId, dexId: "x", pairAddress: "p" + chainId,
    baseToken: { address: "a", name: "n", symbol: "S" },
    priceUsd, liquidity: { usd: liq },
  });

  it("возвращает пару запрошенной сети, а не solana по умолчанию", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: [pair("solana", "1", 10_000), pair("base", "2", 90_000)] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { DexScreenerMarketData } = await import("../src/lib/providers/dexscreener");
    const snap = await new DexScreenerMarketData().getMarketSnapshot("0xabc", "base");
    expect(snap?.priceUsd).toBe(2);
    vi.unstubAllGlobals();
  });

  it("отдаёт null, когда в ответе нет пар запрошенной сети", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: [pair("solana", "1", 10_000)] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { DexScreenerMarketData } = await import("../src/lib/providers/dexscreener");
    expect(await new DexScreenerMarketData().getMarketSnapshot("0xabc", "bsc")).toBeNull();
    vi.unstubAllGlobals();
  });
});
