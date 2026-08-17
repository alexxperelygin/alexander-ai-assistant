import { describe, expect, it } from "vitest";
import { VALIDATED_ENTRY, validatedEntryFires } from "../src/lib/strategy/validated-entry";

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
