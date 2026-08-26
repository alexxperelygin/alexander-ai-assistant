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
  const pair = (chainId: string, priceUsd: string, liq: number, addr = "0xabc") => ({
    chainId, dexId: "x", pairAddress: "p" + chainId + addr,
    baseToken: { address: addr, name: "n", symbol: "S" },
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

  // Пара, где наш токен стоит КОТИРУЕМЫМ, описывает цену другого токена.
  // Раньше такая пара могла оказаться самой ликвидной и подменить цену собой.
  it("не берёт пару, где запрошенный токен не базовый", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: [pair("base", "999", 900_000, "0xDEAD")] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { DexScreenerMarketData } = await import("../src/lib/providers/dexscreener");
    expect(await new DexScreenerMarketData().getMarketSnapshot("0xabc", "base")).toBeNull();
    vi.unstubAllGlobals();
  });

  // Эндпоинт обслуживает за раз одно семейство адресов: минт Solana в списке
  // молча выбрасывает из ответа все EVM-адреса. Пока пачки собирались
  // вперемешку, одна позиция на Solana обнуляла цену всем EVM-позициям своей
  // пачки, и снаружи это выглядело как «источник не отвечает».
  it("не смешивает сети в одном запросе", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => ({ pairs: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { DexScreenerMarketData } = await import("../src/lib/providers/dexscreener");
    await new DexScreenerMarketData().getMarketSnapshots([
      { mint: "0xAAA", chain: "base" },
      { mint: "SoLmint111", chain: "solana" },
      { mint: "0xBBB", chain: "base" },
    ]);
    expect(urls).toHaveLength(2);
    const evm = urls.find((u) => u.includes("0xAAA"));
    expect(evm).toContain("0xBBB");
    expect(evm).not.toContain("SoLmint111");
    vi.unstubAllGlobals();
  });

  // Ради этого метода всё и затевалось: один запрос на 30 адресов вместо
  // тридцати. Ответ приходит вперемешку, и развести его по токенам должен
  // сам провайдер — иначе позиции получат чужие цены.
  it("пачкой разводит перемешанный ответ по токенам и сетям", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pairs: [
          pair("base", "2", 90_000, "0xAAA"),
          pair("bsc", "7", 50_000, "0xBBB"),
          pair("base", "5", 10_000, "0xBBB"),
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { DexScreenerMarketData } = await import("../src/lib/providers/dexscreener");
    const { marketKey } = await import("../src/lib/providers/types");
    const got = await new DexScreenerMarketData().getMarketSnapshots([
      { mint: "0xaaa", chain: "base" }, // регистр адреса другой — должно совпасть
      { mint: "0xBBB", chain: "bsc" },
      { mint: "0xCCC", chain: "base" }, // такого в ответе нет
    ]);
    // Два запроса, а не один: base и bsc в одну пачку класть нельзя.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(got.get(marketKey("0xaaa", "base"))?.priceUsd).toBe(2);
    expect(got.get(marketKey("0xBBB", "bsc"))?.priceUsd).toBe(7);
    expect(got.get(marketKey("0xCCC", "base"))).toBeNull();
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
