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
