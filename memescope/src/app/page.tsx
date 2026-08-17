import Link from "next/link";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { Card, DataModeBadge, Empty, ScoreBar, StatusBadge, fmtUsd, timeAgo } from "@/components/ui";
import { Organism, type NodeState, type OrganNode } from "@/components/Organism";
import { Vital } from "@/components/Vital";
import { LOTTERY_ENTRY, VALIDATED_ENTRY } from "@/lib/strategy/validated-entry";

export const dynamic = "force-dynamic";

// Панель организма. Каждый показатель обязан иметь под собой запрос к базе:
// если числа нет — печатается «нет данных», а не ноль и не прочерк с намёком.
// Красивая панель, показывающая выдуманное состояние, вреднее уродливой.

const DAY_MS = 24 * 3600_000;

export default async function Overview() {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const [
    lastScan, topOpps, openPositions, notifications, todayClosed, sources, recentOpps,
    snaps24h, newTokens24h, errors24h, closedAll, evaluated24h, avoided24h,
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
      take: 40,
    }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.position.findMany({ where: { closedAt: { gte: startOfToday() } } }),
    prisma.sourceHealth.findMany(),
    // ВЫБОРКА, а не полный список: тысяча записей нужна только чтобы посчитать
    // частоты причин отбраковки. Общее число и число отбраковок берутся
    // отдельными count'ами — иначе `take: 1000` печатался бы как «разобрано
    // 1 000 токенов», то есть лимит запроса выдавался бы за измерение.
    prisma.opportunity.findMany({
      where: { updatedAt: { gte: dayAgo } },
      select: { status: true, rejections: true },
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
  ]);

  const scanInfo = lastScan?.details ? JSON.parse(lastScan.details) : null;
  const scanAgeMs = lastScan ? Date.now() - lastScan.createdAt.getTime() : null;
  // Норма — цикл раз в scanIntervalSec. Тройной запас, дальше это уже остановка.
  const scannerOk = scanAgeMs != null && scanAgeMs < config.scanIntervalSec * 3000;
  const dayPnl = todayClosed.reduce((s, p) => s + p.realizedPnlUsd, 0);
  const badSources = sources.filter((s) => s.lastErrorAt && (!s.lastOkAt || s.lastErrorAt > s.lastOkAt));
  const solRegime = topOpps[0] ? safeRegime(topOpps[0].scores) : null;

  const ready = topOpps.filter((o) => o.status === "READY");
  const nearest = topOpps.filter((o) => o.status !== "READY").slice(0, 3);
  // Частоты причин считаются по выборке — это честно и достаточно: нужен
  // порядок «что чаще режет», а не точный счёт. Сами же итоги (разобрано,
  // отбраковано) берутся из count'ов по всей сутке.
  const rejCounts = new Map<string, number>();
  for (const o of recentOpps) {
    if (o.rejections) {
      try {
        for (const r of JSON.parse(o.rejections) as { rule: string }[]) {
          rejCounts.set(r.rule, (rejCounts.get(r.rule) ?? 0) + 1);
        }
      } catch { /* битая запись — не учитываем */ }
    }
  }
  const topRejections = [...rejCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Треки. Складывать их P&L бессмысленно: это разные стратегии.
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

  // Норма метаболизма — 40 000 снапшотов в сутки: это наблюдаемый рабочий темп
  // сканера, а не пожелание. Заметное отклонение вниз означает, что источник
  // режет запросы или воркер спотыкается.
  const METABOLIC_NORM = 40_000;
  const slotsTotal = VALIDATED_ENTRY.maxOpenPositions + LOTTERY_ENTRY.maxOpenPositions;
  const researchOpen = openPositions.filter(
    (p) => p.entryRule === "validated-liquidity" || p.entryRule === "low-liquidity-lottery",
  ).length;

  const organs: OrganNode[] = [
    {
      title: "Рецепторы",
      subtitle: "новые пулы из бирж",
      value: newTokens24h > 0 ? newTokens24h.toLocaleString("ru") : null,
      state: newTokens24h > 0 ? "live" : "idle",
    },
    {
      title: "Наблюдение",
      subtitle: "снимков рынка за 24ч",
      value: snaps24h > 0 ? snaps24h.toLocaleString("ru") : null,
      state: snaps24h === 0 ? "idle" : snaps24h < METABOLIC_NORM * 0.6 ? "warn" : "live",
    },
    {
      title: "Оценка",
      subtitle: "разобрано за 24ч",
      value: evaluated24h > 0 ? evaluated24h.toLocaleString("ru") : null,
      state: evaluated24h > 0 ? "think" : "idle",
    },
    {
      title: "Иммунитет",
      subtitle: "отбраковано за 24ч",
      value: evaluated24h ? share(avoided24h, evaluated24h) : null,
      state: evaluated24h === 0 ? "idle" : avoided24h / evaluated24h > 0.5 ? "good" : "warn",
    },
    {
      title: "Кровоток",
      subtitle: `открытых из ${slotsTotal} слотов`,
      value: `${researchOpen}`,
      state: researchOpen === 0 ? "idle" : researchOpen >= slotsTotal ? "warn" : "live",
    },
    {
      title: "Исход",
      subtitle: "закрыто сделок всего",
      value: closedAll.length > 0 ? `${closedAll.length}` : null,
      state: closedAll.length === 0 ? "idle" : "think",
    },
  ];

  return (
    <div className="relative z-10 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--txt)" }}>
            Жизненные показатели
          </h1>
          <p className="text-[11px]" style={{ color: "var(--txt-dim)" }}>
            состояние организма на {new Date().toLocaleString("ru-RU", { timeZone: "UTC" })} UTC
          </p>
        </div>
        <DataModeBadge mode={config.dataMode} />
      </div>

      <Organism nodes={organs} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Vital
          label="Пульс"
          value={scanAgeMs == null ? null : scannerOk ? "ровный" : "остановлен"}
          state={scanAgeMs == null ? "idle" : scannerOk ? "good" : "bad"}
          note={
            lastScan
              ? `последнее сокращение ${timeAgo(lastScan.createdAt)} назад · разобрано ${scanInfo?.evaluated ?? "?"} токенов`
              : "сканер ни разу не запускался"
          }
        />
        <Vital
          label="Метаболизм"
          value={snaps24h > 0 ? snaps24h.toLocaleString("ru") : null}
          unit="снимков / 24ч"
          state={snaps24h === 0 ? "idle" : snaps24h < METABOLIC_NORM * 0.6 ? "warn" : "live"}
          fill={snaps24h / METABOLIC_NORM}
          note={`рабочий темп — около ${METABOLIC_NORM.toLocaleString("ru")}; заметно ниже означает, что источник режет запросы`}
        />
        <Vital
          label="Температура среды"
          value={solRegime}
          state={temperatureState(solRegime)}
          note="изменение цены SOL за сутки — общий фон рынка, на котором работает отбор"
        />
        <Vital
          label="Травмы"
          value={`${errors24h}`}
          unit="за 24ч"
          state={errors24h === 0 ? "good" : errors24h > 20 ? "bad" : "warn"}
          note="ошибки в журнале: сбои источников, отказы записи, падения циклов"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Vital
          label="Иммунный ответ"
          value={evaluated24h ? share(avoided24h, evaluated24h) : null}
          state={evaluated24h === 0 ? "idle" : "good"}
          fill={evaluated24h ? avoided24h / evaluated24h : undefined}
          note={
            topRejections.length
              ? <>отбраковано {avoided24h.toLocaleString("ru")} из {evaluated24h.toLocaleString("ru")}. Частые причины (по выборке из {recentOpps.length}): {topRejections.map(([r, n]) => `${RU_RULES[r] ?? r} (${n})`).join(", ")}</>
              : "нечего отбраковывать — оценок за сутки не было"
          }
        />
        <Vital
          label="Кровоток"
          value={`${researchOpen} / ${slotsTotal}`}
          state={researchOpen === 0 ? "idle" : researchOpen >= slotsTotal ? "warn" : "live"}
          fill={researchOpen / slotsTotal}
          note="занятых слотов исследовательских треков; при полном заполнении новые входы пропускаются"
        />
        <Vital
          label="Дневной баланс"
          value={todayClosed.length ? fmtUsd(dayPnl, 2) : null}
          state={todayClosed.length === 0 ? "idle" : dayPnl >= 0 ? "good" : "bad"}
          note={`${todayClosed.length} сделок закрыто сегодня · бумажные деньги, живая торговля выключена`}
        />
        <Vital
          label="Каналы восприятия"
          value={sources.length ? `${sources.length - badSources.length} / ${sources.length}` : null}
          state={sources.length === 0 ? "idle" : badSources.length ? "warn" : "good"}
          fill={sources.length ? (sources.length - badSources.length) / sources.length : undefined}
          note={badSources.length ? `не отвечают: ${badSources.map((s) => s.source).join(", ")}` : "все источники данных отвечают"}
        />
      </div>

      {ready.length > 0 ? (
        <div className="card card-good">
          <h2 className="mb-2 text-sm font-semibold glow-good">
            Возбуждение: {ready.length} готовых сигнала(ов)
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
            Покой: покупать нечего
          </h2>
          <p className="text-sm" style={{ color: "var(--txt-dim)" }}>
            За сутки разобрано {evaluated24h.toLocaleString("ru")} токенов, отбраковано{" "}
            {avoided24h.toLocaleString("ru")}. Это норма:
            почти все новые мем-коины — мусор или ловушки, и фильтры обязаны их резать. Сигнал —
            редкое событие, а не ежедневное.
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
        <Card title="Ветви кровеносной системы — три разных правила входа"
              right={<Link className="text-xs glow-live" href="/positions">все позиции →</Link>}>
          <table className="table-base">
            <thead>
              <tr><th>Ветвь</th><th>Открыто</th><th>Закрыто</th><th>Прибыльных</th><th>Итог</th></tr>
            </thead>
            <tbody>
              {trackRows.map((t) => (
                <tr key={t.rule}>
                  <td className="text-xs">{t.title}</td>
                  <td className="tabular-nums">{t.openN}</td>
                  <td className="tabular-nums">{t.closedN}</td>
                  <td className="tabular-nums">{t.closedN ? `${t.wins} из ${t.closedN}` : "—"}</td>
                  {/* Пока ничего не закрыто, «$0» зелёным читается как
                      «вышли в ноль». Это не результат, а его отсутствие. */}
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
        <Card title="Очаги внимания — лучшее в поле зрения"
              right={<Link className="text-xs glow-live" href="/scanner">весь поток →</Link>}>
          {topOpps.length === 0 ? (
            <Empty text="Поле зрения пусто — сканер не отдал ни одной оценки" />
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

        <Card title="Сигналы боли и тревоги"
              right={<Link className="text-xs glow-live" href="/health">диагностика →</Link>}>
          {notifications.length === 0 ? (
            <Empty text="Тихо: система ни на что не жалуется" />
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
  { rule: "low-liquidity-lottery", title: "Низкая ликвидность $10k–$50k · лотерейная ветвь" },
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

function temperatureState(regime: string | null): NodeState {
  if (regime == null) return "idle";
  const v = parseFloat(regime);
  if (!Number.isFinite(v)) return "idle";
  if (v <= -5) return "bad";
  if (v < 0) return "warn";
  return "good";
}

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

function safeRegime(scoresJson: string): string | null {
  try {
    const s = JSON.parse(scoresJson);
    const v = s?.marketRegime?.inputs?.solChange24hPct;
    return typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : null;
  } catch {
    return null;
  }
}
