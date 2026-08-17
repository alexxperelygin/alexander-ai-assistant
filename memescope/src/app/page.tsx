import Link from "next/link";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { Card, DataModeBadge, Empty, ScoreBar, StatusBadge, fmtUsd, timeAgo } from "@/components/ui";
import { Brain, type BrainEdge, type BrainNode, type NodeState } from "@/components/Brain";
import { LOTTERY_ENTRY, VALIDATED_ENTRY } from "@/lib/strategy/validated-entry";

export const dynamic = "force-dynamic";

// Главный экран — карта системы: нейроны-показатели и связи между ними, по
// которым бегут импульсы. Компоновка не декоративная: расположение повторяет
// реальный путь данных в коде, а каждый нейрон обязан иметь под собой запрос
// к базе. Нет числа — печатается «нет данных», а не ноль.

const DAY_MS = 24 * 3600_000;

export default async function Overview() {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const [
    lastScan, topOpps, openPositions, notifications, todayClosed, sources, recentOpps,
    snaps24h, newTokens24h, errors24h, closedAll, evaluated24h, avoided24h, ready24h,
  ] = await Promise.all([
    prisma.auditLog.findFirst({ where: { action: "scan.cycle" }, orderBy: { createdAt: "desc" } }),
    prisma.opportunity.findMany({
      where: { status: { in: ["READY", "CANDIDATE", "WATCH"] } },
      include: { token: true },
      orderBy: { opportunityScore: "desc" },
      take: 8,
    }),
    prisma.position.findMany({
      where: { status: { in: ["OPEN", "PARTIAL_EXIT"] } },
      include: { token: true },
      take: 60,
    }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.position.findMany({ where: { closedAt: { gte: startOfToday() } } }),
    prisma.sourceHealth.findMany(),
    // ВЫБОРКА, а не полный список: тысяча записей нужна только чтобы посчитать
    // частоты причин отбраковки. Итоги берутся отдельными count'ами — иначе
    // `take: 1000` печатался бы как измерение.
    prisma.opportunity.findMany({
      where: { updatedAt: { gte: dayAgo } },
      select: { rejections: true },
      take: 1000,
    }),
    prisma.tokenSnapshot.count({ where: { fetchedAt: { gte: dayAgo } } }),
    prisma.token.count({ where: { firstSeenAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { action: { contains: "error" }, createdAt: { gte: dayAgo } } }),
    prisma.position.findMany({
      where: { status: { in: ["CLOSED", "STOPPED"] } },
      select: { entryRule: true, realizedPnlUsd: true },
    }),
    prisma.opportunity.count({ where: { updatedAt: { gte: dayAgo } } }),
    prisma.opportunity.count({
      where: { updatedAt: { gte: dayAgo }, status: { in: ["AVOID", "DATA_UNAVAILABLE"] } },
    }),
    prisma.signalEvent.count({ where: { toStatus: "READY", createdAt: { gte: dayAgo } } }),
  ]);

  const scanInfo = lastScan?.details ? JSON.parse(lastScan.details) : null;
  const scanAgeMs = lastScan ? Date.now() - lastScan.createdAt.getTime() : null;
  // Норма — цикл раз в scanIntervalSec. Тройной запас, дальше это уже остановка.
  const scannerOk = scanAgeMs != null && scanAgeMs < config.scanIntervalSec * 3000;
  const dayPnl = todayClosed.reduce((s, p) => s + p.realizedPnlUsd, 0);
  const badSources = sources.filter((s) => s.lastErrorAt && (!s.lastOkAt || s.lastErrorAt > s.lastOkAt));

  const ready = topOpps.filter((o) => o.status === "READY");
  const nearest = topOpps.filter((o) => o.status !== "READY").slice(0, 3);
  const rejCounts = new Map<string, number>();
  for (const o of recentOpps) {
    if (!o.rejections) continue;
    try {
      for (const r of JSON.parse(o.rejections) as { rule: string }[]) {
        rejCounts.set(r.rule, (rejCounts.get(r.rule) ?? 0) + 1);
      }
    } catch { /* битая запись — не учитываем */ }
  }
  const topRejections = [...rejCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const trackRows = TRACKS.map((t) => {
    const done = closedAll.filter((p) => (p.entryRule ?? "ready-pipeline") === t.rule);
    const openN = openPositions.filter((p) => (p.entryRule ?? "ready-pipeline") === t.rule).length;
    return {
      ...t,
      openN,
      closedN: done.length,
      pnl: done.reduce((s, p) => s + p.realizedPnlUsd, 0),
      wins: done.filter((p) => p.realizedPnlUsd > 0).length,
    };
  }).filter((t) => t.openN + t.closedN > 0);

  // 40 000 снимков в сутки — наблюдаемый рабочий темп сканера, а не пожелание.
  const SNAP_NORM = 40_000;
  const slotsTotal = VALIDATED_ENTRY.maxOpenPositions + LOTTERY_ENTRY.maxOpenPositions;
  const researchOpen = openPositions.filter(
    (p) => p.entryRule === "validated-liquidity" || p.entryRule === "low-liquidity-lottery",
  ).length;

  // Раскладка повторяет путь данных: слева восприятие, в середине обработка,
  // справа сделки. Координаты подобраны так, чтобы связи не пересекали чужие
  // подписи — схема, мешающая читать числа, хуже отсутствия схемы.
  const nodes: BrainNode[] = [
    { id: "pools", label: "Новые пулы", hint: "обнаружено за 24ч", x: 118, y: 148,
      value: newTokens24h > 0 ? newTokens24h.toLocaleString("ru") : null,
      state: newTokens24h > 0 ? "live" : "idle" },
    { id: "sources", label: "Источники", hint: "отвечают сейчас", x: 112, y: 470,
      value: sources.length ? `${sources.length - badSources.length}/${sources.length}` : null,
      state: sources.length === 0 ? "idle" : badSources.length ? "warn" : "good" },
    { id: "snaps", label: "Снимки рынка", hint: "за 24ч", x: 300, y: 312, big: true,
      value: snaps24h > 0 ? snaps24h.toLocaleString("ru") : null,
      state: snaps24h === 0 ? "idle" : snaps24h < SNAP_NORM * 0.6 ? "warn" : "live" },
    { id: "eval", label: "Разобрано", hint: "оценок за 24ч", x: 520, y: 168, big: true,
      value: evaluated24h > 0 ? evaluated24h.toLocaleString("ru") : null,
      state: evaluated24h > 0 ? "think" : "idle" },
    { id: "reject", label: "Отбраковано", hint: "доля от разобранных", x: 706, y: 88,
      value: evaluated24h ? share(avoided24h, evaluated24h) : null,
      state: evaluated24h === 0 ? "idle" : avoided24h / evaluated24h > 0.5 ? "good" : "warn" },
    { id: "errors", label: "Ошибки", hint: "в журнале за 24ч", x: 470, y: 470,
      value: `${errors24h}`,
      state: errors24h === 0 ? "good" : errors24h > 20 ? "bad" : "warn" },
    { id: "signals", label: "Сигналы READY", hint: "за 24ч", x: 690, y: 330,
      value: `${ready24h}`,
      state: ready24h > 0 ? "good" : "idle" },
    { id: "open", label: "Открытые позиции", hint: `из ${slotsTotal} слотов`, x: 900, y: 200, big: true,
      value: `${researchOpen}`,
      state: researchOpen === 0 ? "idle" : researchOpen >= slotsTotal ? "warn" : "live" },
    { id: "closed", label: "Закрыто сделок", hint: "за всё время", x: 1078, y: 372,
      value: closedAll.length > 0 ? `${closedAll.length}` : null,
      state: closedAll.length === 0 ? "idle" : "think" },
    { id: "pnl", label: "Итог за сегодня", hint: "бумажные деньги", x: 878, y: 508,
      value: todayClosed.length ? fmtUsd(dayPnl, 2) : null,
      state: todayClosed.length === 0 ? "idle" : dayPnl >= 0 ? "good" : "bad" },
  ];

  const edges: BrainEdge[] = [
    { from: "pools", to: "snaps", bend: 40 },
    { from: "sources", to: "snaps", bend: -40 },
    { from: "snaps", to: "eval", bend: 45 },
    { from: "snaps", to: "errors", bend: -25 },
    { from: "eval", to: "reject", bend: 30 },
    { from: "eval", to: "signals", bend: -30 },
    { from: "signals", to: "open", bend: 35 },
    { from: "open", to: "closed", bend: 40 },
    { from: "closed", to: "pnl", bend: -30 },
    // Реальная петля проекта: исход сделок меняет пороги отбора.
    { from: "pnl", to: "eval", bend: -190, feedback: true },
  ];

  const clusters = [
    { title: "Восприятие", x: 205, y: 310, rx: 205, ry: 250, tone: "live" as NodeState },
    { title: "Обработка", x: 600, y: 300, rx: 235, ry: 275, tone: "think" as NodeState },
    { title: "Действие", x: 975, y: 350, rx: 215, ry: 250, tone: "good" as NodeState },
  ];

  return (
    <div className="relative z-10 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--txt)" }}>
            Обзор системы
          </h1>
          <p className="text-[11px]" style={{ color: "var(--txt-dim)" }}>
            {scannerOk ? "сканер работает" : "сканер остановлен"}
            {lastScan ? ` · последний цикл ${timeAgo(lastScan.createdAt)} назад, разобрано ${scanInfo?.evaluated ?? "?"}` : ""}
            {" · "}{new Date().toLocaleString("ru-RU", { timeZone: "UTC" })} UTC
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!scannerOk && (
            <span className="rounded-md px-2 py-0.5 text-xs glow-bad"
                  style={{ border: "1px solid rgba(251,113,133,0.5)", background: "rgba(251,113,133,0.08)" }}>
              сканер не отвечает
            </span>
          )}
          <DataModeBadge mode={config.dataMode} />
        </div>
      </div>

      <Brain nodes={nodes} edges={edges} clusters={clusters} />

      {ready.length > 0 ? (
        <div className="card card-good">
          <h2 className="mb-2 text-sm font-semibold glow-good">
            Готовых сигналов: {ready.length}
          </h2>
          <ul className="space-y-1 text-sm">
            {ready.map((o) => (
              <li key={o.id}>
                <Link href={`/opportunity/${o.id}`} className="font-semibold glow-good hover:underline">
                  {o.token.symbol}
                </Link>{" "}
                — score {o.opportunityScore.toFixed(0)}, риск {o.riskScore.toFixed(0)}. В карточке
                полный план: вход, размер, стоп, фиксация.
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card">
          <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--txt)" }}>
            Покупать нечего
          </h2>
          <p className="text-sm" style={{ color: "var(--txt-dim)" }}>
            За сутки разобрано {evaluated24h.toLocaleString("ru")} токенов, отбраковано{" "}
            {avoided24h.toLocaleString("ru")}.
            {topRejections.length > 0 && (
              <> Частые причины (по выборке из {recentOpps.length}):{" "}
                {topRejections.map(([r, n]) => `${RU_RULES[r] ?? r} (${n})`).join(", ")}.</>
            )}{" "}
            Это норма: почти все новые мем-коины — мусор или ловушки, и фильтры обязаны их
            резать. Сигнал — редкое событие, а не ежедневное.
          </p>
          {nearest.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--txt-faint)" }}>
              Ближе всех к порогу:{" "}
              {nearest.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && " · "}
                  <Link href={`/opportunity/${o.id}`} className="glow-live hover:underline">
                    {o.token.symbol}
                  </Link>{" "}
                  ({o.opportunityScore.toFixed(0)}/100, {o.status})
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {trackRows.length > 0 && (
        <Card title="Три правила входа — считаются раздельно"
              right={<Link className="text-xs glow-live" href="/positions">все позиции →</Link>}>
          <table className="table-base">
            <thead>
              <tr><th>Правило</th><th>Открыто</th><th>Закрыто</th><th>Прибыльных</th><th>Итог</th></tr>
            </thead>
            <tbody>
              {trackRows.map((t) => (
                <tr key={t.rule}>
                  <td className="text-xs">{t.title}</td>
                  <td className="tabular-nums">{t.openN}</td>
                  <td className="tabular-nums">{t.closedN}</td>
                  <td className="tabular-nums">{t.closedN ? `${t.wins} из ${t.closedN}` : "—"}</td>
                  {/* Без закрытых сделок «$0» зелёным читается как «вышли в
                      ноль» — это отсутствие результата, а не результат. */}
                  <td className={
                    t.closedN === 0 ? "glow-idle tabular-nums"
                      : t.pnl >= 0 ? "glow-good tabular-nums" : "glow-bad tabular-nums"
                  }>
                    {t.closedN === 0 ? "нет закрытых" : fmtUsd(t.pnl, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px]" style={{ color: "var(--txt-dim)" }}>
            Складывать эти строки нельзя — это три разные стратегии, а не части одного портфеля.
            До 100 закрытых сделок по проверенному правилу и до 300 по лотерейному их проценты
            не значат ничего: на распределении с толстым хвостом одна сделка двигает среднее на
            сотни процентов.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Лучшее в потоке сканера"
              right={<Link className="text-xs glow-live" href="/scanner">весь поток →</Link>}>
          {topOpps.length === 0 ? (
            <Empty text="Сканер не отдал ни одной оценки" />
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>Токен</th><th>Статус</th><th>Потенциал</th><th>Риск</th><th>Обновлено</th></tr>
              </thead>
              <tbody>
                {topOpps.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/opportunity/${o.id}`} className="glow-live hover:underline">
                        {o.token.symbol}
                      </Link>
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><ScoreBar value={o.opportunityScore} /></td>
                    <td><ScoreBar value={o.riskScore} danger /></td>
                    <td className="text-xs" style={{ color: "var(--txt-faint)" }}>{timeAgo(o.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Предупреждения"
              right={<Link className="text-xs glow-live" href="/health">диагностика →</Link>}>
          {notifications.length === 0 ? (
            <Empty text="Система ни на что не жалуется" />
          ) : (
            <ul className="space-y-2 text-sm">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-2">
                  <span className={
                    n.level === "critical" ? "glow-bad" : n.level === "warning" ? "glow-warn" : "glow-idle"
                  }>●</span>
                  <div className="min-w-0">
                    <span className="font-medium">{n.title}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--txt-faint)" }}>
                      {timeAgo(n.createdAt)}
                    </span>
                    <div className="whitespace-pre-line text-xs" style={{ color: "var(--txt-dim)" }}>
                      {n.body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

const TRACKS = [
  { rule: "validated-liquidity", title: "Проверенное правило · ликвидность > $50k" },
  { rule: "low-liquidity-lottery", title: "Низкая ликвидность $10k–$50k · лотерейное" },
  { rule: "ready-pipeline", title: "Конвейер READY · backtest даёт NO EDGE" },
] as const;

const RU_RULES: Record<string, string> = {
  "too-new": "слишком молодые",
  "insufficient-liquidity": "мало ликвидности",
  "insufficient-data": "не хватает данных",
  "holder-concentration": "концентрация у топ-держателей",
  "slippage-exceeds-limit": "большое проскальзывание",
  "mint-authority": "не отозван mint authority",
  "freeze-authority": "не отозван freeze authority",
  rugged: "признаки rug pull",
  "suspected-wash-trading": "накрутка объёма",
  "sell-not-confirmed": "продажа не подтверждается",
  "sell-not-verified": "продажа не проверяется",
  "critical-contract-risk": "критический риск контракта",
  "insider-concentration": "инсайдерские кошельки",
  "no-contract-risk-source": "нет источника риска контракта",
};

/**
 * Доля в процентах, без округления до круглого, когда оно неправдиво.
 *
 * 4 845 отбраковано из 4 863 — это 99.6%, а обычное округление печатает
 * «100%», то есть «не прошло вообще ничего». Прошло восемнадцать. Ровно
 * такое незаметное округление и превращает панель фактов в панель
 * впечатлений, поэтому у границ 0 и 100 добавляется знак после запятой.
 */
function share(part: number, whole: number): string {
  if (whole <= 0) return "—";
  const v = (part / whole) * 100;
  const rounded = Math.round(v);
  if ((rounded === 100 && v < 100) || (rounded === 0 && v > 0)) return `${v.toFixed(1)}%`;
  return `${rounded}%`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
