import { describe, expect, it } from "vitest";
import { LOTTERY_ENTRY, VALIDATED_ENTRY, lotteryEntryFires, validatedEntryFires } from "../src/lib/strategy/validated-entry";
import { VENTURE_EXIT } from "../src/lib/paper/exit-policy";

// Правило входа живого прогона обязано СОВПАДАТЬ с тем, по которому считается
// проверка в deploy/research.mts (функция collectExitEntries). Расхождение
// здесь не уронит ни сборку, ни тесты общего вида — оно просто тихо превратит
// живой прогон в проверку другой стратегии, и мы этого не заметим. Поэтому
// каждое условие проверяется отдельно и в граничной точке.

describe("validatedEntryFires", () => {
  const ok = { liquidityUsd: 60_000, priceUsd: 0.001, priceChange1h: 5, priceChange24h: 40 };

  it("срабатывает на подходящем наблюдении", () => {
    expect(validatedEntryFires(ok).fires).toBe(true);
  });

  it("порог ликвидности строгий: ровно $50k не проходит", () => {
    // В research.mts стоит `<= opts.minLiquidityUsd` → continue, то есть
    // ровно пороговое значение в выборку НЕ попадает. Нестрогое сравнение
    // здесь добавило бы в живой трек сделки, которых в проверке не было.
    expect(validatedEntryFires({ ...ok, liquidityUsd: VALIDATED_ENTRY.minLiquidityUsd }).fires).toBe(false);
    expect(validatedEntryFires({ ...ok, liquidityUsd: VALIDATED_ENTRY.minLiquidityUsd + 1 }).fires).toBe(true);
  });

  it("отбрасывает артефакт листинга: Δ1ч в точности равна Δ24ч", () => {
    const v = validatedEntryFires({ ...ok, priceChange1h: 120, priceChange24h: 120 });
    expect(v.fires).toBe(false);
    expect(v.fires === false && v.reason).toContain("листинга");
  });

  it("не отбрасывает, когда одна из дельт неизвестна", () => {
    // Условие в проверке требует ОБЕ дельты: при отсутствии одной из них
    // признака артефакта нет, и наблюдение остаётся в выборке.
    expect(validatedEntryFires({ ...ok, priceChange1h: null, priceChange24h: null }).fires).toBe(true);
    expect(validatedEntryFires({ ...ok, priceChange1h: 7, priceChange24h: null }).fires).toBe(true);
  });

  it("без цены входа сделки нет", () => {
    expect(validatedEntryFires({ ...ok, priceUsd: null }).fires).toBe(false);
    expect(validatedEntryFires({ ...ok, priceUsd: 0 }).fires).toBe(false);
  });

  it("отсутствие ликвидности считается нулём, а не пропуском условия", () => {
    expect(validatedEntryFires({ ...ok, liquidityUsd: null }).fires).toBe(false);
    expect(validatedEntryFires({ ...ok, liquidityUsd: undefined }).fires).toBe(false);
  });

  it("замороженные параметры не изменились", () => {
    // Числа взяты из docs/PREREGISTRATION.md. Если этот тест упал, значит
    // кто-то поменял условия уже идущей проверки — а её после старта менять
    // нельзя ни в какую сторону, кроме ужесточения с явной записью в док.
    expect(VALIDATED_ENTRY.minLiquidityUsd).toBe(50_000);
    expect(VALIDATED_ENTRY.positionSizeUsd).toBe(50);
  });
});

describe("lotteryEntryFires", () => {
  const ok = { liquidityUsd: 20_000, priceUsd: 0.001, priceChange1h: 5, priceChange24h: 40 };

  it("срабатывает внутри диапазона $10k–$50k", () => {
    expect(lotteryEntryFires(ok).fires).toBe(true);
  });

  it("границы диапазона строгие снизу и нестрогие сверху", () => {
    expect(lotteryEntryFires({ ...ok, liquidityUsd: LOTTERY_ENTRY.minLiquidityUsd }).fires).toBe(false);
    expect(lotteryEntryFires({ ...ok, liquidityUsd: LOTTERY_ENTRY.minLiquidityUsd + 1 }).fires).toBe(true);
    expect(lotteryEntryFires({ ...ok, liquidityUsd: LOTTERY_ENTRY.maxLiquidityUsd }).fires).toBe(true);
    expect(lotteryEntryFires({ ...ok, liquidityUsd: LOTTERY_ENTRY.maxLiquidityUsd + 1 }).fires).toBe(false);
  });

  it("треки не пересекаются: ни одно наблюдение не проходит оба правила", () => {
    // Главное свойство конструкции. Если оно нарушится, один и тот же токен
    // попадёт в две выборки, и обе проверки будут считать одну сделку дважды.
    for (const liq of [5_000, 9_999, 10_000, 10_001, 25_000, 49_999, 50_000, 50_001, 120_000]) {
      const obs = { ...ok, liquidityUsd: liq };
      const both = validatedEntryFires(obs).fires && lotteryEntryFires(obs).fires;
      expect(both).toBe(false);
    }
  });

  it("отбрасывает артефакт листинга так же, как проверенное правило", () => {
    expect(lotteryEntryFires({ ...ok, priceChange1h: 300, priceChange24h: 300 }).fires).toBe(false);
  });

  it("замороженные параметры не изменились", () => {
    expect(LOTTERY_ENTRY.minLiquidityUsd).toBe(10_000);
    expect(LOTTERY_ENTRY.maxLiquidityUsd).toBe(VALIDATED_ENTRY.minLiquidityUsd);
    expect(LOTTERY_ENTRY.positionSizeUsd).toBe(50);
  });
});

describe("политика выхода лотерейного трека", () => {
  it("трейлинга нет, жёсткий стоп на месте", () => {
    // Если trailPct станет ненулевым, трек начнёт срезать ровно те иксы, ради
    // которых он и заведён, — и об этом не скажет ни один другой тест.
    expect(VENTURE_EXIT.trailPct).toBe(0);
    expect(VENTURE_EXIT.stopPct).toBe(0.2);
    expect(VENTURE_EXIT.liquidityFloorRatio).toBe(0.6);
  });
});
