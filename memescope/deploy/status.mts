// Собирает состояние системы в markdown-отчёт (запускается НА сервере):
//   cd /opt/alexander-ai-assistant/memescope && npx tsx deploy/status.mts
// Используется workflow'ом .github/workflows/status.yml для публикации
// status/latest.md — чтобы состояние сервера было видно без захода на него.
import { prisma } from "../src/lib/db";
import { FREEZE_AT } from "../src/lib/paper/exit-policy";
import { STALE_ALERT_INTERVAL_MS } from "../src/lib/monitor/positions";
import { LOTTERY_ENTRY, VALIDATED_ENTRY } from "../src/lib/strategy/validated-entry";

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

// Состояние ВЕБ-процесса. Раньше отчёт следил только за воркером, и когда
// 12 августа дашборд четыре часа отдавал 503, отчёт всё это время бодро
// сообщал «worker работает» — потому что воркер и правда работал, а панель
// лежала. Пробел закрыт: pm2 знает и число перезапусков, и потребление
// памяти, а именно перезапуски по лимиту 500 МБ — главный подозреваемый.
{
  const { execFileSync } = await import("node:child_process");
  try {
    const raw = execFileSync("pm2", ["jlist"], { encoding: "utf8", timeout: 10_000 });
    const procs = JSON.parse(raw) as {
      name: string;
      pm2_env?: { status?: string; restart_time?: number };
      monit?: { memory?: number };
    }[];
    for (const name of ["memescope-web", "memescope-worker"]) {
      const p = procs.find((x) => x.name === name);
      if (!p) { lines.push(`- ${name}: 🔴 процесса нет в pm2`); continue; }
      const mb = Math.round((p.monit?.memory ?? 0) / 1024 / 1024);
      const restarts = p.pm2_env?.restart_time ?? 0;
      const st = p.pm2_env?.status ?? "?";
      // Много перезапусков при памяти у лимита = процесс циклически падает,
      // и одиночный restart вылечит это лишь до следующего раза.
      const warn = st !== "online" ? "🔴" : restarts > 20 ? "⚠️" : "";
      lines.push(`- ${name}: ${warn} ${st}, память ${mb} МБ, перезапусков ${restarts}`);
    }
  } catch (e) {
    lines.push(`- состояние pm2 недоступно: ${String(e).slice(0, 120)}`);
  }

  // Состояние процесса — не то же самое, что работоспособность сервиса.
  // 13 августа pm2 сообщал «online, перезапусков 0», пока панель отдавала 503
  // на каждый запрос: процесс жил, но не отвечал. Проверка, добавленная днём
  // раньше, этого не ловила, потому что спрашивала не то. Единственный
  // честный признак — реальный HTTP-запрос к приложению.
  try {
    const { readFileSync } = await import("node:fs");
    let port = "3000";
    for (const p of ["../.web-port", ".web-port", "/opt/alexander-ai-assistant/.web-port"]) {
      try { port = readFileSync(p, "utf8").trim(); break; } catch { /* следующий путь */ }
    }
    const t0 = Date.now();
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(8000) });
    const ms = Date.now() - t0;
    lines.push(
      res.ok || res.status === 401
        ? `- дашборд: ✅ отвечает (HTTP ${res.status}, ${ms} мс, порт ${port})`
        : `- дашборд: 🔴 HTTP ${res.status} за ${ms} мс (порт ${port})`,
    );
  } catch (e) {
    lines.push(`- дашборд: 🔴 НЕ ОТВЕЧАЕТ — ${String(e).slice(0, 100)}`);
  }
}
lines.push(``);

// Разбивка по сетям: подтверждает, что мультичейн-сканирование реально
// доходит до базы, а не молча падает на одной сети.
const since24h = new Date(Date.now() - 24 * 3600_000);
const chainGroups = await prisma.token.groupBy({
  by: ["chain"],
  where: { firstSeenAt: { gte: since24h } },
  _count: { _all: true },
});
// Действующие настройки риска. Печатаются потому, что сохранённое в БД
// значение перекрывает значение по умолчанию: без этой строки нельзя отличить
// «порог поднят» от «порог поднят только в коде».
const settingsRow = await prisma.setting.findUnique({ where: { key: "riskSettings" } });
if (settingsRow) {
  try {
    const rs = JSON.parse(settingsRow.value) as Record<string, unknown>;
    lines.push(`## Действующие пороги`);
    lines.push(`- минимальная ликвидность: $${Number(rs.minLiquidityUsd ?? 0).toLocaleString("ru")}`);
    lines.push(`- размер позиции ≤ $${rs.maxPositionUsd}; риск на сделку ${rs.maxRiskPerTradePct}%; slippage ≤ ${rs.maxSlippagePct}%`);
    lines.push(`- возраст токена: ${rs.minTokenAgeMin}–${rs.maxTokenAgeMin} мин; живая торговля: ${rs.liveTradingEnabled ? "🔴 ВКЛЮЧЕНА" : "выключена"}`);
    lines.push(``);
  } catch {
    lines.push(`## Действующие пороги`, `- не удалось прочитать сохранённые настройки`, ``);
  }
}

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
// Расход и результат по КАЖДОМУ соцсточнику. Раньше печатался только X, и
// по остальным нельзя было отличить «ключа нет» от «ключ есть, но не работает».
const socialSources = await prisma.socialSnapshot.groupBy({
  by: ["source"],
  where: { fetchedAt: { gte: since24h } },
  _count: { _all: true },
  _sum: { postsRead: true, mentions: true },
});
lines.push(`## Социальные источники (24ч)`);
if (socialSources.length === 0) {
  lines.push(`- снимков нет: ни один ключ не настроен, либо ни один токен ещё не прошёл порог ликвидности`);
}
for (const g of socialSources.sort((a, b) => b._count._all - a._count._all)) {
  const last = await prisma.socialSnapshot.findFirst({
    where: { source: g.source },
    orderBy: { fetchedAt: "desc" },
    include: { token: true },
  });
  const errs = last?.errors ? ` ⚠ ${last.errors}` : "";
  lines.push(
    `- **${g.source}**: запросов ${g._count._all}, прочитано ${g._sum.postsRead ?? 0}, ` +
      `упоминаний ${g._sum.mentions ?? 0}; последний — ${last?.token.symbol ?? "—"} (${ago(last?.fetchedAt)})${errs}`,
  );
}
const socialErrors = await prisma.auditLog.findMany({
  where: { action: "social.error", createdAt: { gte: since24h } },
  orderBy: { createdAt: "desc" },
  take: 3,
});
if (socialErrors.length > 0) {
  lines.push(`- 🔴 ошибок обращения за 24ч: ${socialErrors.length} (последние ниже)`);
  for (const e of socialErrors) lines.push(`    · ${(e.details ?? "").slice(0, 160)}`);
}
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

// Часть сделок закрыта по последней известной цене, потому что источник
// перестал их котировать. Их результат — не измерение, а допущение, и он уже
// сидит внутри общей суммы realized P&L. Если не показать эту долю отдельно,
// итоговая цифра тихо смешивает посчитанное с придуманным.
{
  // Общая сумма P&L мешает две разные вещи: сделки по старым правилам (стоп
  // −35% плюс лесенка тейков, которая измеримо срезала доходность) и сделки
  // по замороженным правилам, прошедшим проверку. Первые уже история, вторые —
  // единственное, что здесь похоже на боевую проверку выходов, поэтому их
  // результат надо видеть отдельно, а не растворённым в общем минусе.
  {
    const closed = positions.filter((p) => p.status === "CLOSED" || p.status === "STOPPED");
    const post = closed.filter((p) => p.openedAt.getTime() >= FREEZE_AT.getTime());
    const pre = closed.filter((p) => p.openedAt.getTime() < FREEZE_AT.getTime());
    const sum = (xs: typeof closed) => xs.reduce((s, p) => s + p.realizedPnlUsd, 0);
    lines.push(
      `- по замороженным правилам (после ${FREEZE_AT.toISOString().slice(0, 10)}): ${post.length} закрытых, ` +
      `$${sum(post).toFixed(2)}; по старым правилам: ${pre.length} закрытых, $${sum(pre).toFixed(2)}`,
    );
    if (post.length) {
      const wins = post.filter((p) => p.realizedPnlUsd > 0).length;
      lines.push(`  · из них прибыльных ${wins} из ${post.length}`);
    }
  }

  // ДВА ТРЕКА, И СМЕШИВАТЬ ИХ НЕЛЬЗЯ.
  //
  // ready-pipeline — вход по конвейеру скоринга. Про него backtest говорит
  // NO EDGE, и живые сделки это подтверждают. validated-liquidity — правило,
  // прошедшее предзарегистрированную проверку, запущено 17 августа.
  // Общая сумма P&L складывает результаты двух РАЗНЫХ стратегий: по ней
  // невозможно понять, работает ли проверенное правило, и легко приписать
  // ему чужой убыток или чужую прибыль.
  {
    const closed = positions.filter((p) => p.status === "CLOSED" || p.status === "STOPPED");
    const track = (rule: string) => closed.filter((p) => (p.entryRule ?? "ready-pipeline") === rule);
    const openTrack = (rule: string) => open.filter((p) => (p.entryRule ?? "ready-pipeline") === rule);
    const sum = (xs: typeof closed) => xs.reduce((s, p) => s + p.realizedPnlUsd, 0);
    for (const [rule, title] of [
      ["validated-liquidity", "проверенное правило (ликвидность > $50k)"],
      ["low-liquidity-lottery", "низкая ликвидность $10k–$50k (лотерейный трек)"],
      ["ready-pipeline", "конвейер READY (backtest: NO EDGE)"],
    ] as const) {
      const c = track(rule);
      const o = openTrack(rule);
      if (!c.length && !o.length) continue;
      const wins = c.filter((p) => p.realizedPnlUsd > 0).length;
      const med = c.length
        ? [...c].map((p) => p.realizedPnlUsd / (p.costUsd || 1)).sort((a, b) => a - b)[Math.floor(c.length / 2)]
        : null;
      // «P&L $0.00» у трека без закрытых сделок читается как «вышли в ноль».
      // Это не результат, а его отсутствие. Ту же правку уже сделали на
      // дашборде и на странице позиций — отчёт обязан говорить то же самое,
      // иначе одно и то же состояние описывается двумя способами.
      // ЧУВСТВИТЕЛЬНОСТЬ К ДОПУЩЕНИЮ. Часть сделок закрыта по последней
      // известной цене, потому что источник перестал котировать токен. Такой
      // исход почти всегда ЛУЧШЕ настоящего: перестают котировать в первую
      // очередь умершие токены, а последняя цена — ещё живая. То есть итог
      // трека завышен, и вопрос лишь насколько.
      //
      // Одной оговорки под таблицей мало: 18 августа доля таких закрытий
      // дошла до трети всех завершённых сделок, и по общей сумме нельзя было
      // понять, сколько результата держится на допущении. Печатаем итог без
      // них рядом — разрыв между двумя числами и есть цена допущения.
      const solid = c.filter((p) => !p.closeReason?.includes("НЕДОСТОВЕРЕН"));
      const shakySet = c.filter((p) => p.closeReason?.includes("НЕДОСТОВЕРЕН"));
      const shaky = shakySet.length;
      lines.push(
        `- трек «${title}»: открыто ${o.length}, закрыто ${c.length}` +
        (c.length
          ? `, P&L $${sum(c).toFixed(2)}, прибыльных ${wins} из ${c.length}, медиана сделки ${((med ?? 0) * 100).toFixed(1)}%` +
            (shaky
              ? `; из них ${shaky} закрыто по устаревшей цене, без них итог $${sum(solid).toFixed(2)} по ${solid.length} сделкам` +
                // ВТОРАЯ ГРАНИЦА. Первый прогон этого замера показал, что
                // недостоверные закрытия дают около −1% на сделку, тогда как
                // измеренные сделки теряют куда больше. Для токена, который
                // источник перестал котировать, «почти в ноль» неправдоподобно:
                // котировать перестают умершие. То есть эти сделки записаны
                // подозрительно выгодно, и их вклад надо ограничивать с двух
                // сторон, а не одной цифрой.
                `; если все они на деле обнулились — $${(sum(solid) - shakySet.reduce((a, p) => a + p.costUsd, 0)).toFixed(2)}`
              : "")
          : `, закрытых пока нет — итога тоже нет`),
      );
    }
    // Пока сделок мало, любые проценты по треку — шум. Об этом лучше сказать
    // прямо, чем дать прочитать промежуточную цифру как результат.
    const vClosed = track("validated-liquidity").length;
    if (vClosed > 0 && vClosed < 100)
      lines.push(`  · ⚠️ по проверенному правилу закрыто ${vClosed} сделок из 100 минимально нужных — читать этот процент как результат нельзя`);
    // У лотерейного трека порог осмысленности выше: там весь результат решают
    // редкие хвосты, и до 300 сделок среднее скачет на сотни процентов от
    // одного события. Меньший порог означал бы, что цифру начнут читать раньше,
    // чем она вообще что-то значит.
    const lClosed = track("low-liquidity-lottery").length;
    if (lClosed > 0 && lClosed < 300)
      lines.push(`  · ⚠️ по лотерейному треку закрыто ${lClosed} сделок из 300 минимально нужных — на хвостовом распределении это ещё не результат`);

    // Пропущенные входы — единственное известное расхождение живого прогона с
    // пересчётом по истории. Молча их не показывать нельзя: без этой строки
    // трек выглядит полной копией проверенного правила, а он ею не является.
    // Считаются РАЗНЫЕ токены, а не записи. Одна запись на попытку давала
    // 353 отказа за сутки при 25 слотах — почти все повторные, по одним и тем
    // же токенам, и цифра читалась как «правило дало 353 входа». Столько
    // разных токенов не было; повторы теперь и не возникают (токен, однажды
    // отклонённый, больше не рассматривается), но считать всё равно надо по
    // токенам: иначе старые записи в окне продолжают завышать число.
    const skips = await prisma.auditLog.findMany({
      where: { action: "validated.entry.skipped", createdAt: { gte: since24h } },
      select: { details: true },
    });
    const skippedTokens = new Set<string>();
    for (const s of skips) {
      try {
        const id = (JSON.parse(s.details ?? "{}") as { tokenId?: string }).tokenId;
        if (id) skippedTokens.add(id);
      } catch { /* битая запись — просто не учитываем */ }
    }
    if (skippedTokens.size)
      lines.push(
        `  · пропущено токенов за 24ч (нет свободного слота): ${skippedTokens.size} при ` +
        `${VALIDATED_ENTRY.maxOpenPositions}+${LOTTERY_ENTRY.maxOpenPositions} слотах — ` +
        `выборка треков этим смещена, см. docs/PREREGISTRATION.md`,
      );
  }

  // НЕИЗМЕРИМЫЕ СДЕЛКИ. Позиция, у которой за 6 часов после входа не появилось
  // ни одного наблюдения с ценой, помечается INVALIDATED и в статистику треков
  // не входит — исход неизвестен, и придумывать его нельзя.
  //
  // Но и молчать про них нельзя. Источник перестаёт котировать в первую очередь
  // умершие токены, то есть выбрасываются преимущественно ХУДШИЕ исходы. Если
  // доля таких сделок вырастет, все результаты треков окажутся завышены, и
  // заметить это можно только по этой строке.
  {
    const unmeasurable = positions.filter((p) => p.status === "INVALIDATED");
    const measured = positions.filter((p) => p.status === "CLOSED" || p.status === "STOPPED");
    if (unmeasurable.length) {
      const share = (unmeasurable.length / (unmeasurable.length + measured.length)) * 100;
      lines.push(
        `- ⚠️ исключено как НЕИЗМЕРИМЫЕ: ${unmeasurable.length} шт (${share.toFixed(1)}% от всех завершённых) — ` +
        // Причина не одна: либо цены не было вовсе, либо выход не исполнялся
        // (симулятор отказывается моделировать сделку при неизвестной
        // ликвидности). Первая формулировка называла только первый случай, а
        // обе позиции 18 августа попали сюда по второму — то есть строка
        // указывала неверную причину.
        `цену выхода получить не удалось: либо её не было ни в одном источнике, либо выход не исполнялся. ` +
        `Эти сделки не входят ни в один итог выше. ` +
        `Рост этой доли завышает результаты треков: источник перестаёт котировать прежде всего умершие токены`,
      );
    }
  }

  // Полные списания: пул не смог принять позицию. Это измеренный плохой исход,
  // он ВХОДИТ в итоги треков — но цена выхода взята нулевой как допущение, и
  // об этом надо говорить, а не прятать внутри суммы.
  {
    const wiped = positions.filter((p) => p.closeReason?.includes("списан ПОЛНОСТЬЮ"));
    if (wiped.length) {
      const sum = wiped.reduce((s, p) => s + p.realizedPnlUsd, 0);
      lines.push(
        `- ⚠️ списано полностью (пул не может принять позицию): ${wiped.length} шт на $${sum.toFixed(2)} — ` +
        `входит в итоги выше. Цена выхода взята нулевой: это допущение в консервативную сторону, а не измерение`,
      );
    }
  }

  const unreliable = positions.filter((p) => p.closeReason?.includes("НЕДОСТОВЕРЕН"));
  if (unreliable.length) {
    const sum = unreliable.reduce((s, p) => s + p.realizedPnlUsd, 0);
    lines.push(
      `- из них закрыто по устаревшей цене (результат недостоверен): ${unreliable.length} шт на $${sum.toFixed(2)} — ` +
      `эта часть суммы выше является допущением, а не измерением`,
    );
  }
}

// Позиция, по которой источник перестал отдавать цену, не проверяется ни
// стопом, ни трейлингом. Такую надо видеть в отчёте числом, а не вылавливать
// глазами в списке событий: незамеченная, она означает открытую сделку без
// какой-либо защиты.
// Признак берётся из ALERT-событий монитора, а НЕ из возраста снапшота.
// Разница существенная: снапшоты пишет сканер, и он может не опрашивать токен
// сутками, пока монитор спокойно получает по нему цену напрямую. По возрасту
// снапшота отчёт объявлял бы «стоп не проверяется» там, где всё работает, —
// то есть врал бы в сторону тревоги, а такому отчёту перестают верить.
{
  // Окно должно быть чуть больше периода повтора предупреждения: тогда
  // «есть событие в окне» означает «состояние держится СЕЙЧАС». При окне в
  // 90 минут против часового повтора строка показывала уже исчезнувшую
  // проблему — 17 августа отчёт после исправления перечислил восемнадцать
  // позиций, у которых всё уже работало, и проверить исправление по отчёту
  // было нельзя.
  const since = new Date(Date.now() - (STALE_ALERT_INTERVAL_MS + 5 * 60_000));
  // Два РАЗНЫХ состояния, и путать их нельзя. «Работает по запасному
  // источнику» — позиция защищена, стоп считается. «Цены нет вообще» —
  // защиты нет. Оба пишутся как ALERT, поэтому различаем по началу текста.
  const noPrice: string[] = [];
  const onFallback: string[] = [];
  const partial: string[] = [];
  const sellFailed: string[] = [];
  for (const p of open) {
    const alerts = await prisma.positionEvent.findMany({
      where: { positionId: p.id, kind: "ALERT", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, message: true },
    });
    const latest = alerts[0];
    if (!latest) continue;
    const mins = Math.round((Date.now() - latest.createdAt.getTime()) / 60_000);
    const label = `${p.token.symbol} (${mins} мин назад)`;
    if (latest.message.includes("устарел")) partial.push(label);
    else if (latest.message.startsWith("Прямой запрос")) onFallback.push(label);
    // «Продажа не исполнена» — ОТДЕЛЬНОЕ состояние, а не «цены нет». Раньше
    // оно попадало в общую кучу, и отчёт полтора часа показывал неверный
    // диагноз: цена-то была, не исполнялся выход. Разные болезни нельзя
    // печатать одной строкой, иначе лечишь не то.
    else if (latest.message.startsWith("Продажа не исполнена"))
      sellFailed.push(`${p.token.symbol} (позиции ${((Date.now() - p.openedAt.getTime()) / 3600_000).toFixed(1)} ч; «${latest.message.slice(0, 60)}»)`);
    else {
      // Для позиции без цены печатаем ВОЗРАСТ и точный текст предупреждения.
      // 18 августа две такие позиции не закрывались, хотя механика закрытия
      // есть, и по короткой строке нельзя было понять, какая ветка кода
      // отрабатывает: «нет данных вообще» или «нет свежих данных N минут».
      // Разница решает, где ошибка, а гадать по косвенным признакам —
      // ровно то, из-за чего дефекты живут долго.
      const ageH = ((Date.now() - p.openedAt.getTime()) / 3600_000).toFixed(1);
      noPrice.push(`${p.token.symbol} (алерт ${mins} мин назад, позиции ${ageH} ч; «${latest.message.slice(0, 70)}»)`);
    }
  }
  lines.push(
    noPrice.length
      ? `- ⚠️ цены нет ни из одного источника, стоп и трейлинг НЕ проверяются: ${noPrice.join(", ")}`
      : `- цена доступна по всем открытым позициям`,
  );
  if (partial.length)
    lines.push(`- ⚠️ цена устарела: стоп и обвал ликвидности проверяются, трейлинг — нет: ${partial.join(", ")}`);
  if (sellFailed.length)
    lines.push(`- 🔴 выход НЕ ИСПОЛНЯЕТСЯ (симулятор отказывается моделировать сделку): ${sellFailed.join(", ")}`);
  if (onFallback.length)
    lines.push(`- ℹ️ считаются по снапшотам сканера (прямой запрос молчит, защита работает): ${onFallback.join(", ")}`);
}
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
