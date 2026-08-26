import { describe, expect, it, vi } from "vitest";

// Арифметика чтения пула проверяется отдельно, потому что её ошибки молчат:
// неверная цена не падает и не логируется, она просто попадает в результат
// сделки и становится частью статистики. Живые пулы 26 августа сошлись с
// котировочным источником с точностью 0.03–0.12% (V2 и V3, четыре сети), но
// на живых данных нельзя проверить крайние случаи — разные decimals, порядок
// токенов в паре, отказ при непонятной второй стороне.

const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const WETH_BASE = "0x4200000000000000000000000000000000000006";

/** 32-байтное слово из числа. */
const w = (v: bigint | number) => BigInt(v).toString(16).padStart(64, "0");
/** Адрес, дополненный до слова. */
const wa = (a: string) => a.replace("0x", "").toLowerCase().padStart(64, "0");

interface PoolFixture {
  token0: string;
  token1: string;
  dec0: number;
  dec1: number;
  /** Нет — значит пул не V2 и getReserves отвечает откатом. */
  reserves?: [bigint, bigint];
  sqrtPriceX96?: bigint;
  balances?: Record<string, bigint>;
}

/** Подменяет сеть: отвечает на eth_call так, как ответил бы узел. */
function stubRpc(pool: PoolFixture) {
  const fetchMock = vi.fn(async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? "{}");
    const { to, data } = body.params?.[0] ?? {};
    const sel = String(data).slice(0, 10);
    const target = String(to).toLowerCase();
    const reply = (result: string | null) => ({
      ok: true,
      json: async () => (result == null ? { error: { message: "execution reverted" } } : { result }),
    });

    if (sel === "0x0dfe1681") return reply("0x" + wa(pool.token0));
    if (sel === "0xd21220a7") return reply("0x" + wa(pool.token1));
    if (sel === "0x313ce567") {
      const d = target === pool.token0.toLowerCase() ? pool.dec0 : pool.dec1;
      return reply("0x" + w(d));
    }
    if (sel === "0x0902f1ac") {
      if (!pool.reserves) return reply(null);
      return reply("0x" + w(pool.reserves[0]) + w(pool.reserves[1]) + w(0));
    }
    if (sel === "0x3850c7bd") {
      if (pool.sqrtPriceX96 == null) return reply(null);
      return reply("0x" + w(pool.sqrtPriceX96) + w(0) + w(0) + w(0));
    }
    if (sel === "0x70a08231") return reply("0x" + w(pool.balances?.[target] ?? 0n));
    return reply(null);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function load() {
  vi.resetModules();
  return (await import("../src/lib/providers/onchain")).readPoolState;
}

describe("readPoolState", () => {
  it("V2: цена как отношение резервов, разные decimals у сторон", async () => {
    const token = "0x1111111111111111111111111111111111111111";
    stubRpc({
      token0: token, token1: USDC_BASE, dec0: 18, dec1: 6,
      // 1000 токенов против 2000 USDC → токен стоит $2.
      reserves: [1000n * 10n ** 18n, 2000n * 10n ** 6n],
    });
    const read = await load();
    const r = await read("base", "0xpair000000000000000000000000000000000001", token);
    expect(r?.kind).toBe("v2");
    expect(r?.priceUsd).toBeCloseTo(2, 9);
    // Обе стороны равны по стоимости, глубина — удвоенная сторона котировки.
    expect(r?.liquidityUsd).toBeCloseTo(4000, 6);
    vi.unstubAllGlobals();
  });

  it("V2: порядок токенов в паре не меняет цену", async () => {
    const token = "0xffffffffffffffffffffffffffffffffffffffff";
    stubRpc({
      // Здесь наш токен — ВТОРОЙ, стороны зеркальны предыдущему тесту.
      token0: USDC_BASE, token1: token, dec0: 6, dec1: 18,
      reserves: [2000n * 10n ** 6n, 1000n * 10n ** 18n],
    });
    const read = await load();
    const r = await read("base", "0xpair000000000000000000000000000000000002", token);
    expect(r?.priceUsd).toBeCloseTo(2, 9);
    vi.unstubAllGlobals();
  });

  it("V3: цена берётся из тика, а не из остатков на пуле", async () => {
    const token = "0x2222222222222222222222222222222222222222";
    // sqrtPriceX96 для цены token0→token1 = 4 (в сырых единицах при равных
    // decimals): sqrt(4) * 2^96 = 2 * 2^96.
    stubRpc({
      token0: token, token1: USDC_BASE, dec0: 18, dec1: 18,
      sqrtPriceX96: 2n * 2n ** 96n,
      balances: { [USDC_BASE]: 500n * 10n ** 18n },
    });
    const read = await load();
    const r = await read("base", "0xpair000000000000000000000000000000000003", token);
    expect(r?.kind).toBe("v3");
    expect(r?.priceUsd).toBeCloseTo(4, 6);
    // Глубина — по реальным остаткам, а не по формуле постоянного произведения.
    expect(r?.liquidityUsd).toBeCloseTo(1000, 6);
    vi.unstubAllGlobals();
  });

  it("отказывается считать, если вторая сторона пары непонятна", async () => {
    const token = "0x3333333333333333333333333333333333333333";
    const exotic = "0x4444444444444444444444444444444444444444";
    stubRpc({
      token0: token, token1: exotic, dec0: 18, dec1: 18,
      reserves: [1000n * 10n ** 18n, 2000n * 10n ** 18n],
    });
    const read = await load();
    // Курс такой стороны к доллару взять неоткуда. Подставить единицу значило
    // бы выдумать цену — молчание честнее.
    expect(await read("base", "0xpair000000000000000000000000000000000004", token)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("не выдаёт цену по чужому токену", async () => {
    const token = "0x5555555555555555555555555555555555555555";
    stubRpc({
      token0: "0x6666666666666666666666666666666666666666", token1: USDC_BASE,
      dec0: 18, dec1: 6, reserves: [1000n * 10n ** 18n, 2000n * 10n ** 6n],
    });
    const read = await load();
    expect(await read("base", "0xpair000000000000000000000000000000000005", token)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("пустой пул не даёт цены вместо деления на ноль", async () => {
    const token = "0x7777777777777777777777777777777777777777";
    stubRpc({
      token0: token, token1: USDC_BASE, dec0: 18, dec1: 6, reserves: [0n, 0n],
    });
    const read = await load();
    expect(await read("base", "0xpair000000000000000000000000000000000006", token)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("сеть без настроенного узла читать не пытается", async () => {
    const fetchMock = stubRpc({
      token0: "0x8888888888888888888888888888888888888888", token1: WETH_BASE,
      dec0: 18, dec1: 18, reserves: [1n, 1n],
    });
    const read = await load();
    expect(await read("solana", "poolAddr", "someMint")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
