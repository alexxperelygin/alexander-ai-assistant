import { prisma } from "./db";
import { DEFAULT_RISK_SETTINGS, type RiskSettings } from "./types";

const KEY = "riskSettings";

export async function getRiskSettings(): Promise<RiskSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return { ...DEFAULT_RISK_SETTINGS };
  try {
    const parsed = JSON.parse(row.value) as Partial<RiskSettings>;
    // Merge over defaults so new fields get sane values after upgrades.
    const merged = { ...DEFAULT_RISK_SETTINGS, ...parsed };
    // Live trading is hard-disabled in stage 1 regardless of stored value.
    merged.liveTradingEnabled = false;
    return merged;
  } catch {
    return { ...DEFAULT_RISK_SETTINGS };
  }
}

/**
 * Разовые миграции сохранённых настроек.
 *
 * Ловушка, из-за которой это появилось: сохранённая в БД настройка ПЕРЕКРЫВАЕТ
 * значение по умолчанию. Порог ликвидности был поднят 10k → 50k по результатам
 * исследования, но на сервере уже лежала запись с 10 000 — и новый порог
 * молча не действовал, хотя в коде и документации стоял. Правки дефолтов
 * недостаточно: нужно менять сохранённое значение явно и под запись в журнал.
 *
 * Каждая миграция помечается ключом и применяется один раз, чтобы не затирать
 * осознанные изменения владельца в Settings.
 */
const MIGRATIONS: { key: string; apply: (s: RiskSettings) => RiskSettings | null }[] = [
  {
    key: "migration:min-liquidity-50k",
    apply: (s) =>
      s.minLiquidityUsd < 50_000 ? { ...s, minLiquidityUsd: 50_000 } : null,
  },
  {
    // В БД лежали 20% риска на сделку и позиция $100, хотя модель риска и
    // документация описывали 1% и $50. Расхождение нашлось, когда действующие
    // пороги вывели в отчёт; владелец подтвердил возврат к 1%.
    key: "migration:risk-1pct",
    apply: (s) =>
      s.maxRiskPerTradePct > 1 || s.maxPositionUsd > 50
        ? { ...s, maxRiskPerTradePct: 1, maxPositionUsd: 50 }
        : null,
  },
];

export async function applySettingsMigrations(): Promise<string[]> {
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    const done = await prisma.setting.findUnique({ where: { key: m.key } });
    if (done) continue;
    const current = await getRiskSettings();
    const next = m.apply(current);
    if (next) {
      await prisma.setting.upsert({
        where: { key: KEY },
        create: { key: KEY, value: JSON.stringify(next) },
        update: { value: JSON.stringify(next) },
      });
      await prisma.auditLog.create({
        data: {
          actor: "system",
          action: "settings.migration",
          details: JSON.stringify({ migration: m.key, from: current, to: next }),
        },
      });
      applied.push(m.key);
    }
    await prisma.setting.upsert({
      where: { key: m.key },
      create: { key: m.key, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });
  }
  return applied;
}

export async function saveRiskSettings(next: RiskSettings): Promise<void> {
  next.liveTradingEnabled = false; // stage-1 invariant
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  await prisma.auditLog.create({
    data: { actor: "user", action: "settings.update", details: JSON.stringify(next) },
  });
}
