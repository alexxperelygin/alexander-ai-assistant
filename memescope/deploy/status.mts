// Собирает состояние системы в markdown-отчёт (запускается НА сервере):
//   cd /opt/alexander-ai-assistant/memescope && npx tsx deploy/status.mts
// Используется workflow'ом .github/workflows/status.yml для публикации
// status/latest.md — чтобы состояние сервера было видно без захода на него.
import { prisma } from "../src/lib/db";

function ago(d: Date | null | undefined): string {
  if (!d) return "—";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 60) return `${min} мин назад`;
  if (min < 1440) return `${(min / 60).toFixed(1)} ч назад`;
  return `${(min / 1440).toFixed(1)} дн назад`;
}

const dayAgo = new Date(Date.now() - 24 * 3600_000);

const [
  lastScan,
  tokenCount,
  snaps24h,
  oppsByStatus,
  readyEvents,
  positions,
  lastBacktest,
  health,
  errors24h,
  topOpps,
] = await Promise.all([
  prisma.auditLog.findFirst({ where: { action: "scan.cycle" }, orderBy: { createdAt: "desc" } }),
  prisma.token.count(),
  prisma.tokenSnapshot.count({ where: { fetchedAt: { gte: dayAgo } } }),
  prisma.opportunity.groupBy({ by: ["status"], _count: { _all: true } }),
  prisma.signalEvent.findMany({
    where: { toStatus: "READY" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { opportunity: { include: { token: true } } },
  }),
  prisma.position.findMany({ include: { token: true } }),
  prisma.backtestRun.findFirst({ orderBy: { createdAt: "desc" } }),
  prisma.sourceHealth.findMany({ orderBy: { source: "asc" } }),
  prisma.auditLog.count({ where: { action: { contains: "error" }, createdAt: { gte: dayAgo } } }),
  prisma.opportunity.findMany({
    where: { status: { in: ["READY", "CANDIDATE", "WATCH"] } },
    orderBy: { opportunityScore: "desc" },
    take: 5,
    include: { token: true },
  }),
]);

const scanAgeMin = lastScan ? (Date.now() - lastScan.createdAt.getTime()) / 60000 : null;
const workerOk = scanAgeMin != null && scanAgeMin < 5;
const open = positions.filter((p) => p.status === "OPEN" || p.status === "PARTIAL_EXIT");
const realized = positions.reduce((s, p) => s + p.realizedPnlUsd, 0);

const lines: string[] = [];
lines.push(`# MemeScope AI — статус сервера`);
lines.push(``);
lines.push(`Сгенерирован: ${new Date().toISOString()} (UTC)`);
lines.push(``);
lines.push(`## Ядро`);
lines.push(`- Worker: ${workerOk ? "✅ работает" : "🔴 НЕ РАБОТАЕТ"} (последний цикл: ${ago(lastScan?.createdAt)})`);
lines.push(`- Токенов в базе: ${tokenCount}; снапшотов за 24ч: ${snaps24h}`);
lines.push(`- Ошибок в audit log за 24ч: ${errors24h}`);
lines.push(``);
lines.push(`## Статусы возможностей`);
for (const g of oppsByStatus.sort((a, b) => b._count._all - a._count._all)) {
  lines.push(`- ${g.status}: ${g._count._all}`);
}
lines.push(``);
lines.push(`## Топ-5 по score (не отбракованные)`);
if (topOpps.length === 0) lines.push(`- пока пусто`);
for (const o of topOpps) {
  lines.push(
    `- ${o.token.symbol}: ${o.status}, score ${o.opportunityScore.toFixed(1)}, risk ${o.riskScore.toFixed(1)}, conf ${(o.confidence * 100).toFixed(0)}% (обновлено ${ago(o.updatedAt)})`,
  );
}
lines.push(``);
lines.push(`## READY-сигналы (последние 5 за всё время)`);
if (readyEvents.length === 0) lines.push(`- ещё не было`);
for (const e of readyEvents) {
  lines.push(`- ${e.opportunity.token.symbol} — ${e.createdAt.toISOString()} (${ago(e.createdAt)})`);
}
lines.push(``);
lines.push(`## Позиции`);
lines.push(`- Открытых: ${open.length}; всего: ${positions.length}; realized P&L: $${realized.toFixed(2)}`);
lines.push(``);
lines.push(`## Последние позиции (детально)`);
const recentPositions = await prisma.position.findMany({
  orderBy: { openedAt: "desc" },
  take: 10,
  include: {
    token: true,
    events: { orderBy: { createdAt: "desc" }, take: 2 },
  },
});
if (recentPositions.length === 0) lines.push(`- нет`);
for (const p of recentPositions) {
  lines.push(
    `- ${p.token.symbol} [${p.mode}/${p.status}] вход $${p.entryPriceUsd.toPrecision(4)} × ${p.quantity.toFixed(0)} = $${p.costUsd.toFixed(2)}, ` +
      `остаток ${((p.remainingQty / p.quantity) * 100).toFixed(0)}%, realized $${p.realizedPnlUsd.toFixed(2)}` +
      (p.closeReason ? `, закрыта: ${p.closeReason}` : ""),
  );
  for (const e of p.events) lines.push(`    · ${e.createdAt.toISOString().slice(11, 19)} [${e.kind}] ${e.message.slice(0, 140)}`);
}
lines.push(``);
lines.push(`## Последний backtest`);
if (lastBacktest) {
  lines.push(`- ${lastBacktest.status} (${ago(lastBacktest.createdAt)}): ${lastBacktest.notes ?? ""}`);
} else {
  lines.push(`- ещё не запускался`);
}
lines.push(``);
lines.push(`## Источники данных`);
for (const s of health) {
  const ok = s.lastOkAt && (!s.lastErrorAt || s.lastOkAt > s.lastErrorAt);
  lines.push(
    `- ${s.source}: ${ok ? "ok" : "🔴 " + (s.lastError ?? "error")} (ok ${s.okCount} / err ${s.errorCount}, последний успех ${ago(s.lastOkAt)})`,
  );
}
lines.push(``);

console.log(lines.join("\n"));
process.exit(0);
