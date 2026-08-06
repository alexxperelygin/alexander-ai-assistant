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

// Разбивка по сетям: подтверждает, что мультичейн-сканирование реально
// доходит до базы, а не молча падает на одной сети.
const since24h = new Date(Date.now() - 24 * 3600_000);
const chainGroups = await prisma.token.groupBy({
  by: ["chain"],
  where: { firstSeenAt: { gte: since24h } },
  _count: { _all: true },
});
lines.push(`## Новые токены за 24ч по сетям`);
if (chainGroups.length === 0) lines.push(`- (нет новых токенов)`);
for (const g of chainGroups.sort((a, b) => b._count._all - a._count._all)) {
  lines.push(`- ${g.chain}: ${g._count._all}`);
}
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
// Мигание статусов (READY → что-то → READY за минуты) означает, что какое-то
// правило срабатывает через раз. Причина перехода записана в SignalEvent —
// печатаем её, чтобы диагностировать по факту, а не по догадке.
const recentEvents = await prisma.signalEvent.findMany({
  orderBy: { createdAt: "desc" },
  take: 12,
  include: { opportunity: { include: { token: true } } },
});
// Расход платного источника. Без этого невозможно понять, работает ли ключ и
// во сколько обходятся сутки: у pay-per-use цена ошибки — прямой расход баланса.
const daySocial = await prisma.socialSnapshot.aggregate({
  where: { source: "x", fetchedAt: { gte: since24h } },
  _sum: { postsRead: true },
  _count: { _all: true },
});
const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
const monthSocial = await prisma.socialSnapshot.aggregate({
  where: { source: "x", fetchedAt: { gte: monthStart } },
  _sum: { postsRead: true },
});
const lastSocial = await prisma.socialSnapshot.findFirst({
  where: { source: "x" },
  orderBy: { fetchedAt: "desc" },
  include: { token: true },
});
lines.push(`## X (соцданные)`);
if (!lastSocial) {
  lines.push(`- снимков нет (ключ не задан или ни один токен ещё не дошёл до CANDIDATE/READY)`);
} else {
  lines.push(`- запросов за 24ч: ${daySocial._count._all}; постов прочитано за 24ч: ${daySocial._sum.postsRead ?? 0}; за месяц: ${monthSocial._sum.postsRead ?? 0}`);
  const errs = lastSocial.errors ? ` — ${lastSocial.errors}` : "";
  lines.push(`- последний: ${lastSocial.token.symbol} (${ago(lastSocial.fetchedAt)}) — упоминаний ${lastSocial.mentions ?? "—"}, авторов ${lastSocial.uniqueAuthors ?? "—"}, охват ${lastSocial.reach ?? "—"}, свежих аккаунтов ${lastSocial.freshAccountShare == null ? "—" : `${Math.round(lastSocial.freshAccountShare * 100)}%`}${errs}`);
}
const socialErrors = await prisma.auditLog.count({
  where: { action: "social.error", createdAt: { gte: since24h } },
});
if (socialErrors > 0) lines.push(`- 🔴 ошибок обращения к X за 24ч: ${socialErrors}`);
lines.push(``);

lines.push(`## Последние переходы статусов`);
if (recentEvents.length === 0) lines.push(`- (переходов нет)`);
for (const e of recentEvents) {
  const reason = (e.reason ?? "").replace(/\s+/g, " ").slice(0, 130);
  lines.push(`- ${e.opportunity.token.symbol}: ${e.fromStatus ?? "—"} → ${e.toStatus} (${ago(e.createdAt)}) — ${reason}`);
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
