import { prisma } from "../db";
import { getProviders } from "../providers";
import { marketKey } from "../providers/types";
import { readPoolState } from "../providers/onchain";
import { notify } from "../notify/notifier";
import { sellPosition, type SellArgs } from "../paper/portfolio";
import { FROZEN_EXIT, VENTURE_EXIT, FREEZE_AT } from "../paper/exit-policy";

// Position monitoring pass: refresh market state for every open position,
// enforce stops / take-profits / liquidity-drain exits, and alert on risk
// changes. Runs from the worker every MONITOR_INTERVAL_SEC.

interface Tp { price: number; fraction: number; done: boolean }

/**
 * Как часто повторять предупреждение об отсутствии цены.
 *
 * Был час — и из-за этого отчёт врал. Строка «прямой запрос молчит» строится
 * по ALERT-событиям за последние 90 минут, а при часовом повторе событие
 * живёт в этом окне ещё долго после того, как источник ожил: 17 августа
 * отчёт, снятый через минуту после исправления, показал восемнадцать позиций
 * «на запасном источнике» — все записи были сделаны ДО перезапуска. Проверить
 * по такому отчёту, помогло исправление или нет, невозможно.
 *
 * Пятнадцать минут — это не больше четырёх событий в час на позицию, шума
 * почти нет, зато отчётное окно в 20 минут означает ровно то, что написано:
 * позиция на запасном источнике СЕЙЧАС, а не когда-то за последний час.
 */
export const STALE_ALERT_INTERVAL_MS = 15 * 60_000;
/** Через сколько без цены позиция считается непригодной к сопровождению. */
const STALE_EXIT_MS = 6 * 3600_000;

/** Свежесть, при которой снапшот сканера равноценен прямому запросу. */
const FALLBACK_MAX_AGE_MS = 30 * 60_000;

/**
 * Последний снапшот токена, годный хоть для чего-то, и признак «он несвежий».
 *
 * Между тридцатью минутами и шестью часами была дыра: снапшот уже не считался
 * пригодным, но и до принудительного закрытия дело не доходило, поэтому
 * позиция до пяти с половиной часов жила вообще без стопа. Именно в такой
 * дыре сейчас висят BLUAI и FWA.
 *
 * Устаревшая цена не годится для решений «держим дальше» — трейлинг по ней
 * посчитать нельзя, максимум прошлой цены неизвестен. Но для решения «пора
 * выходить» она осмысленна: если полтора часа назад цена была ниже стопа,
 * это факт, а не догадка, и выйти поздно честнее, чем не выйти вовсе.
 */
async function lastUsableSnapshot(tokenId: string) {
  const s = await prisma.tokenSnapshot.findFirst({
    where: { tokenId, priceUsd: { gt: 0 }, fetchedAt: { gte: new Date(Date.now() - STALE_EXIT_MS) } },
    orderBy: { fetchedAt: "desc" },
  });
  if (s?.priceUsd == null) return null;
  return { snap: s, stale: Date.now() - s.fetchedAt.getTime() > FALLBACK_MAX_AGE_MS };
}

/** Отмечает работу на запасном источнике — не чаще раза в час, для диагностики. */
async function noteFallback(positionId: string, at: Date, stale: boolean): Promise<void> {
  const last = await prisma.positionEvent.findFirst({
    where: { positionId, kind: "ALERT" },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < STALE_ALERT_INTERVAL_MS) return;
  await prisma.positionEvent.create({
    data: {
      positionId, kind: "ALERT",
      message: stale
        ? `Прямой запрос цены не отвечает, снапшот сканера устарел (${at.toISOString()}): проверяются только стоп и обвал ликвидности, трейлинг — нет.`
        : `Прямой запрос цены не отвечает; стоп и трейлинг считаются по снапшоту сканера от ${at.toISOString()}.`,
    },
  });
}

/**
 * Что делать, когда цены нет НИГДЕ — ни прямым запросом, ни в свежих снапшотах.
 *
 * Раньше монитор просто писал ALERT и уходил — каждые тридцать секунд, вечно.
 * Две беды. Первая: позиция без цены не проверяется ни стопом, ни трейлингом,
 * ни лимитом удержания (все они стоят ПОСЛЕ этой проверки), то есть открытая
 * сделка оставалась вообще без защиты и не закрывалась никогда. Вторая:
 * тысячи одинаковых событий, в которых тонет всё остальное.
 *
 * Правильного ответа тут нет: цены нет, значит честного результата тоже нет.
 * Из двух неправд — «висит вечно» и «закрыта по последней известной цене с
 * пометкой, что результат недостоверен» — вторая хотя бы не притворяется
 * работающим мониторингом.
 */
/**
 * Пометить позицию неизмеримой: исход неизвестен, и придумывать его нельзя.
 *
 * INVALIDATED не входит в статистику треков (там считаются только CLOSED и
 * STOPPED), но и молча исчезнуть не должен: источник перестаёт котировать
 * прежде всего умершие токены, поэтому выбрасывались бы преимущественно
 * ХУДШИЕ исходы, и все результаты оказались бы завышены. Отчёт печатает долю
 * таких сделок отдельной строкой с предупреждением.
 */
async function markUnmeasurable(positionId: string, reason: string): Promise<void> {
  await prisma.position.update({
    where: { id: positionId },
    data: {
      status: "INVALIDATED",
      remainingQty: 0,
      closedAt: new Date(),
      closeReason: `${reason} Исход сделки НЕИЗМЕРИМ и в статистику не входит.`,
      events: { create: { kind: "ALERT", message: `Позиция признана неизмеримой. ${reason}` } },
    },
  }).catch(async (e) => notify("warning", "Не удалось пометить позицию неизмеримой", String(e)));
}

async function handleMissingPrice(positionId: string, tokenId: string, openedAt: Date): Promise<void> {
  const last = await prisma.tokenSnapshot.findFirst({
    where: { tokenId, priceUsd: { gt: 0 } },
    orderBy: { fetchedAt: "desc" },
  });
  const ageMs = last ? Date.now() - last.fetchedAt.getTime() : Infinity;

  if (last?.priceUsd != null && ageMs >= STALE_EXIT_MS) {
    const hours = Math.round(ageMs / 3600_000);
    try {
      await sellPosition({
        positionId, fraction: 1, priceUsd: last.priceUsd, liquidityUsd: last.liquidityUsd,
        reason: `Источник не отдаёт цену ${hours} ч — выход по последней известной цене ` +
          `$${last.priceUsd.toPrecision(6)} от ${last.fetchedAt.toISOString()}. ` +
          `Результат этой сделки НЕДОСТОВЕРЕН: реальная цена выхода неизвестна.`,
        kind: "CLOSE",
      });
    } catch (e) {
      // АВАРИЙНЫЙ ВЫХОД БЫЛ ЗАБЛОКИРОВАН ТЕМ ЖЕ, ОТ ЧЕГО ЗАЩИЩАЛ.
      //
      // simulateFill отказывается моделировать сделку при неизвестной
      // ликвидности — и правильно делает, качество исполнения там неизвестно.
      // Но у токена, который источник перестал котировать, ликвидность как раз
      // неизвестна ВСЕГДА. То есть предохранитель «источник умер — выходим»
      // не срабатывал именно в том случае, ради которого написан, и позиция
      // висела без стопа бесконечно: 牛来 и WMW провисели так 27 часов,
      // повторяя «Продажа не исполнена» каждые 15 минут.
      //
      // Придумать цену выхода нельзя, значит исход неизмерим — и позиция
      // помечается соответственно, а не остаётся открытой навсегда.
      await markUnmeasurable(
        positionId,
        `Источник не отдаёт цену ${hours} ч, а закрыть сделку не удалось: ${String(e)}.`,
      );
    }
    return;
  }

  // ДЫРА, ЗАКРЫТАЯ 18 АВГУСТА.
  //
  // Ветка выше срабатывает только если снимок с ценой вообще существует
  // (`last?.priceUsd != null`). Когда у токена нет НИ ОДНОГО снимка с ценой,
  // `last` равен null, принудительное закрытие не срабатывает никогда, и
  // позиция висит вечно: без стопа, без трейлинга, без предельного срока —
  // все три проверки стоят после получения цены. Нашлось на живых позициях
  // 牛来 и WMW, провисевших в этом состоянии больше полутора часов.
  //
  // Закрыть по цене нельзя — цены нет и придумывать её недопустимо. Поэтому
  // сделка помечается INVALIDATED: исход неизмерим, и в статистику треков она
  // не входит (там считаются только CLOSED и STOPPED).
  //
  // ВАЖНО про смещение. Молча выбрасывать неизмеримые сделки нельзя: источник
  // чаще всего перестаёт котировать именно умершие токены, то есть выбрасывались
  // бы худшие исходы и результат систематически завышался. Поэтому число таких
  // сделок печатается в отчёте отдельной строкой с предупреждением.
  if (last == null && Date.now() - openedAt.getTime() >= STALE_EXIT_MS) {
    const hours = Math.round((Date.now() - openedAt.getTime()) / 3600_000);
    await markUnmeasurable(
      positionId,
      `За ${hours} ч у токена не появилось ни одного наблюдения с ценой — закрыть по цене невозможно.`,
    );
    return;
  }

  // Предупреждение не чаще раза в час: смысл в том, чтобы проблему было видно,
  // а не в том, чтобы забить журнал.
  const lastAlert = await prisma.positionEvent.findFirst({
    where: { positionId, kind: "ALERT" },
    orderBy: { createdAt: "desc" },
  });
  if (lastAlert && Date.now() - lastAlert.createdAt.getTime() < STALE_ALERT_INTERVAL_MS) return;
  await prisma.positionEvent.create({
    data: {
      positionId, kind: "ALERT",
      message: last
        ? `Нет свежих данных цены ${Math.round(ageMs / 60_000)} мин — мониторинг деградирован, стоп и трейлинг не проверяются.`
        : "Нет данных цены вообще — мониторинг деградирован, стоп и трейлинг не проверяются.",
    },
  });
}

/**
 * Закрыть позицию как полную потерю, когда пул физически не может её принять.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ НЕИЗМЕРИМЫХ. Причин неисполнимого выхода две, и путать их
 * нельзя:
 *
 *  · «ликвидность неизвестна» — про рынок неизвестно ничего, исход честно
 *    неизмерим, сделка исключается из статистики;
 *  · «проскальзывание ≥50%, объём несопоставим с пулом» — ликвидность как раз
 *    ИЗВЕСТНА, просто пул слишком мелкий. Это не отсутствие данных, а факт:
 *    выйти нельзя, позиция ничего не стоит.
 *
 * Пометить второй случай неизмеримым означало бы систематически выбрасывать из
 * статистики самые плохие исходы — схлопнувшиеся пулы, — и завышать результат
 * всех треков. Ровно та выживаемость, против которой построено исследование.
 *
 * Точную цену выхода здесь взять неоткуда, поэтому берётся ноль. Это допущение,
 * и выбрано оно намеренно в сторону, которая НЕ МОЖЕТ нам польстить: занизить
 * собственный результат безопасно, завысить — нет.
 */
async function closeAsTotalLoss(positionId: string, reason: string): Promise<void> {
  const pos = await prisma.position.findUnique({ where: { id: positionId } });
  if (!pos) return;
  const costBasis = (pos.remainingQty / pos.quantity) * pos.costUsd;
  await prisma.position.update({
    where: { id: positionId },
    data: {
      status: "STOPPED",
      remainingQty: 0,
      closedAt: new Date(),
      realizedPnlUsd: pos.realizedPnlUsd - costBasis,
      closeReason:
        `${reason} Выйти невозможно ни по какой цене, поэтому остаток списан ПОЛНОСТЬЮ. ` +
        `Это допущение в консервативную сторону, а не измеренная цена выхода.`,
      events: {
        create: {
          kind: "STOP_HIT",
          message: `Списано как полная потеря: пул не может принять позицию. ${reason}`,
        },
      },
    },
  }).catch(async (e) => notify("warning", "Не удалось списать позицию", String(e)));
}

/** Сколько терпим неисполняемый выход, прежде чем признать сделку неизмеримой. */
const EXIT_GIVE_UP_MS = 60 * 60_000;

/**
 * Выход из позиции с признанием поражения.
 *
 * Каждый вызов sellPosition в мониторе раньше висел на `.catch(notify)`:
 * ошибка уходила в уведомление, а позиция ОСТАВАЛАСЬ ОТКРЫТОЙ и повторяла
 * попытку каждые 30 секунд. Для восстановимого сбоя это правильно. Но при
 * неизвестной ликвидности simulateFill отказывается моделировать сделку
 * всегда — и позиция висит без стопа, без трейлинга и без предельного срока
 * бесконечно. Так 牛来 и WMW провисели 27 часов.
 *
 * Одна неудача ещё ничего не значит: источник мог моргнуть. Но если выход не
 * исполняется больше часа, сделка фактически неуправляема, а её исход
 * неизмерим — придумывать цену выхода нельзя.
 */
async function tryExit(args: SellArgs, level: "critical" | "warning", title: string): Promise<void> {
  try {
    await sellPosition(args);
  } catch (e) {
    // sellPosition уже записал ALERT «Продажа не исполнена» перед броском,
    // поэтому первая запись найдётся здесь же и отсчёт начнётся с неё.
    const firstFail = await prisma.positionEvent.findFirst({
      where: {
        positionId: args.positionId,
        kind: "ALERT",
        message: { startsWith: "Продажа не исполнена" },
      },
      orderBy: { createdAt: "asc" },
    });
    const stuckMs = firstFail ? Date.now() - firstFail.createdAt.getTime() : 0;
    if (stuckMs >= EXIT_GIVE_UP_MS) {
      const hours = Math.round(stuckMs / 3600_000);
      // Развилка по причине отказа. «Проскальзывание ≥50%» означает, что
      // ликвидность известна и мала, то есть исход ИЗМЕРИМ и он плохой.
      // Отправить его в неизмеримые — значит убрать худшие сделки из
      // статистики и завысить результаты треков.
      if (String(e).includes("проскальзывание")) {
        await closeAsTotalLoss(args.positionId, `Выход не исполняется ${hours} ч подряд: ${String(e)}.`);
      } else {
        await markUnmeasurable(args.positionId, `Выход не исполняется ${hours} ч подряд: ${String(e)}.`);
      }
      return;
    }
    await notify(level, title, String(e));
  }
}

export async function monitorPositionsOnce(): Promise<void> {
  const providers = getProviders();
  const open = await prisma.position.findMany({
    where: { status: { in: ["OPEN", "PARTIAL_EXIT"] } },
    include: { token: true },
  });

  // Цены на весь цикл берём одним заходом, пачками по 30 адресов. Данные и
  // частота опроса те же самые — меняется только число запросов к источнику.
  //
  // 24 августа монитор при 39 открытых позициях слал 78 запросов в минуту при
  // потолке источника 240; сканер добирал остальное, и очередь встала в
  // собственный троттлинг. Со стороны это выглядело как «сервер тормозит»,
  // хотя load average был 0.06: процесс просто ждал своей очереди. Цены по
  // трети позиций устаревали, трейлинг-стоп по ним переставал считаться, а
  // доля закрытий по устаревшей цене выросла с 29 из 116 до 49 из 142 за шесть
  // часов — то есть портилась ровно та величина, ради которой трек и живёт.
  const prefetched = providers.market.getMarketSnapshots
    ? await providers.market.getMarketSnapshots(
        open.map((p) => ({ mint: p.token.mint, chain: p.token.chain })),
      )
    : new Map<string, Awaited<ReturnType<typeof providers.market.getMarketSnapshot>>>();

  for (const pos of open) {
    try {
      // Прямой запрос — основной путь. Но если он не отвечает по этому токену,
      // это ещё не значит, что цены нет: сканер пишет снапшоты по своему
      // маршруту и часто продолжает видеть тот же токен. Отчёт показал ровно
      // такую пару — монитор молчит по BITCOIN, BLUAI и FWA, а данные в базе
      // свежие. Отказываться от защиты позиции, имея цену под рукой, нельзя.
      // Сеть передаётся ОБЯЗАТЕЛЬНО. Её здесь не было, а у провайдера параметр
      // по умолчанию равен "solana", и внутри стоит фильтр
      // `pairs.filter(p => p.chainId === chain)`. То есть по каждой позиции в
      // base, bsc, ethereum и arbitrum ответ отфильтровывался в ноль и запрос
      // возвращал null — «прямой запрос молчит». Монитор уходил на снапшоты
      // сканера, а по ним трейлинг-стоп считается только пока снапшот свежее
      // 30 минут; дальше позиция жила с одним лишь жёстким стопом.
      //
      // Нашлось это сразу после запуска трека проверенного правила: 18 новых
      // позиций, почти все в bsc и base, одновременно перешли на запасной
      // источник. Сам трек и строился ради того, чтобы выход считался по
      // прямому запросу цены, а не по частоте опроса сканера, — то есть без
      // этой строки он проверял бы ровно то же, что и пересчёт по истории.
      // Пачка могла не дойти целиком (сеть, 429) — тогда по этому токену
      // спрашиваем отдельно, как раньше. Отсутствие записи и записанный null
      // различаются: null означает «источник ответил, пары нет».
      const key = marketKey(pos.token.mint, pos.token.chain);
      const snap = prefetched.has(key)
        ? prefetched.get(key) ?? null
        : await providers.market.getMarketSnapshot(pos.token.mint, pos.token.chain);
      let price: number;
      let liq: number | null;
      // Цена устарела — решения «держим дальше» по ней принимать нельзя.
      let stalePrice = false;
      if (snap?.priceUsd != null) {
        price = snap.priceUsd;
        liq = snap.liquidityUsd ?? null;
      } else {
        // ЧТЕНИЕ ПУЛА НАПРЯМУЮ. Котировочный источник замолкает раньше, чем
        // токен перестаёт торговаться, и замолкает не случайно: первыми
        // выпадают умирающие. Позиция закрывалась по последней известной цене,
        // то есть по цене ДО обвала, и результат записывался лучше настоящего.
        // К 26 августа так закрывалось 92 сделки из 203 в одном треке и 121 из
        // 163 в другом.
        //
        // Резервы пула отдаёт сам блокчейн — ровно тогда, когда посредник молчит.
        // Цена оттуда СВЕЖАЯ (состояние текущего блока), поэтому stalePrice
        // остаётся false и трейлинг-стоп продолжает считаться. В этом и смысл:
        // запасной снапшот сканера трейлинг отключал.
        const onchain = pos.token.pairAddress
          ? await readPoolState(pos.token.chain, pos.token.pairAddress, pos.token.mint)
          : null;
        if (onchain) {
          price = onchain.priceUsd;
          liq = onchain.liquidityUsd;
        } else {
          const fallback = await lastUsableSnapshot(pos.tokenId);
          if (!fallback) {
            await handleMissingPrice(pos.id, pos.tokenId, pos.openedAt);
            continue;
          }
          price = fallback.snap.priceUsd as number;
          liq = fallback.snap.liquidityUsd;
          stalePrice = fallback.stale;
          await noteFallback(pos.id, fallback.snap.fetchedAt, fallback.stale);
        }
      }

      // Entry-time liquidity from OPEN event, for drain detection.
      const openEvent = await prisma.positionEvent.findFirst({
        where: { positionId: pos.id, kind: "OPEN" },
      });
      const openPayload = openEvent?.payload ? JSON.parse(openEvent.payload) : {};
      const entryLiq: number | null = openPayload.liquidityUsd ?? null;
      if (entryLiq == null && liq != null) {
        // Backfill once so future drain checks have a baseline.
        await prisma.positionEvent.update({
          where: { id: openEvent!.id },
          data: { payload: JSON.stringify({ ...openPayload, liquidityUsd: liq }) },
        });
      }

      // Пик цены с момента входа — база трейлинг-стопа. Обновляется ДО
      // проверок выхода: иначе первое же наблюдение нового максимума
      // сравнивалось бы с устаревшим пиком и трейлинг срабатывал бы поздно.
      // Устаревшая цена в пик не идёт: максимум — это «где цена была», а по
      // старому снапшоту мы не знаем, что происходило после него.
      const peak = stalePrice
        ? (pos.peakPriceUsd ?? pos.entryPriceUsd)
        : Math.max(pos.peakPriceUsd ?? pos.entryPriceUsd, price);
      if (!stalePrice && peak > (pos.peakPriceUsd ?? 0)) {
        await prisma.position.update({ where: { id: pos.id }, data: { peakPriceUsd: peak } })
          .catch(() => {}); // позиция могла закрыться параллельно
      }

      // Политика выхода зависит от ТРЕКА, а не только от даты открытия.
      // Определяется ДО первой проверки: если часть выходов считать по одной
      // политике, а часть по другой, позиция будет жить по правилам, которых
      // нет ни в одном документе.
      //
      // Трек низкой ликвидности живёт по венчурным правилам: трейлинг-стоп там
      // убран намеренно. Он закрывает позицию при откате на 30% от максимума,
      // то есть обрубает ровно тот рост в десятки раз, ради которого трек и
      // существует. Жёсткий стоп и аварийный выход по ликвидности остаются:
      // именно они держат тело распределения, а без этого хвост не окупается.
      const exit = pos.entryRule === "low-liquidity-lottery" ? VENTURE_EXIT : FROZEN_EXIT;

      // 1) Liquidity drain → emergency exit (rug in progress).
      if (entryLiq != null && liq != null && liq < entryLiq * exit.liquidityFloorRatio) {
        await tryExit({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Ликвидность упала до $${Math.round(liq).toLocaleString()} (<${Math.round(exit.liquidityFloorRatio * 100)}% от входа) — аварийный выход`,
          kind: "STOP_HIT",
        }, "critical", "Аварийный выход не исполнен");
        continue;
      }

      // 2) Stop-loss.
      if (pos.stopPriceUsd != null && price <= pos.stopPriceUsd) {
        await tryExit({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Stop: цена $${price.toPrecision(6)} ≤ стопа $${pos.stopPriceUsd.toPrecision(6)}`,
          kind: "STOP_HIT",
        }, "critical", "Stop не исполнен");
        continue;
      }

      // Позиции, открытые ДО заморозки правил, доживают по своим прежним
      // условиям. Менять условия уже открытой сделки задним числом нельзя:
      // её результат перестанет быть сравнимым, а именно на сравнимости
      // держится вся проверка после 8 августа.
      const frozenRules = pos.openedAt.getTime() >= FREEZE_AT.getTime();

      // 3) Трейлинг-стоп от максимума. Смысл правила: не обрубать прибыль
      // заранее, но и не отдавать обратно уже набранный рост. Именно оно
      // заменило лесенку частичных фиксаций — та продавала на 1.5x и 2x и
      // тем самым убивала редкие крупные выигрыши, ради которых стратегия
      // и существует (docs/PREREGISTRATION.md).
      // Трейлинг по устаревшей цене не считается: он сравнивает текущую цену с
      // максимумом, а «текущей» у нас в этот момент нет. Жёсткий стоп и обвал
      // ликвидности выше — считаются, потому что они говорят «стало плохо»,
      // и сработать поздно там лучше, чем не сработать совсем.
      const trailStop = peak * (1 - exit.trailPct);
      // exit.trailPct === 0 означает «трейлинга нет». Без явной проверки
      // trailStop совпал бы с пиком, и позиция закрывалась бы при первом же
      // тике ниже максимума — то есть венчурный трек резался бы жёстче всех.
      if (exit.trailPct > 0 && frozenRules && !stalePrice && peak > pos.entryPriceUsd && price <= trailStop) {
        await tryExit({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Трейлинг: цена $${price.toPrecision(6)} ≤ ${Math.round((1 - exit.trailPct) * 100)}% от максимума $${peak.toPrecision(6)}`,
          kind: "STOP_HIT",
        }, "critical", "Трейлинг не исполнен");
        continue;
      }

      // 4) Предельный срок удержания. Без него позиция может висеть неделями:
      // проверка стратегии считает результат на горизонте 3 суток, и живой
      // портфель должен закрываться там же, иначе отчёт и портфель измеряют
      // разные вещи.
      const heldMin = (Date.now() - pos.openedAt.getTime()) / 60_000;
      if (frozenRules && heldMin >= exit.maxHoldMin) {
        await tryExit({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Достигнут предельный срок удержания ${Math.round(exit.maxHoldMin / 1440)} сут — выход по времени`,
          kind: "CLOSE",
        }, "warning", "Выход по времени не исполнен");
        continue;
      }

      // 5) Лесенка тейков. Для НОВЫХ позиций она пуста (см. выше); код
      // остаётся ради позиций, открытых до заморозки правил, — менять их
      // условия задним числом нельзя, иначе их результат станет несравнимым.
      const tps: Tp[] = pos.takeProfits ? JSON.parse(pos.takeProfits) : [];
      let changed = false;
      for (const tp of tps) {
        if (!tp.done && price >= tp.price) {
          const fracOfRemaining = Math.min(1, (tp.fraction * pos.quantity) / pos.remainingQty);
          await tryExit({
            positionId: pos.id, fraction: fracOfRemaining, priceUsd: price, liquidityUsd: liq,
            reason: `Take-profit ${(tp.price / pos.entryPriceUsd).toFixed(1)}x достигнут`,
            kind: "TP_HIT",
          }, "warning", "TP не исполнен");
          tp.done = true;
          changed = true;
          // Re-read remaining qty for next TP in the ladder.
          const fresh = await prisma.position.findUnique({ where: { id: pos.id } });
          if (!fresh || fresh.remainingQty <= 0) break;
          pos.remainingQty = fresh.remainingQty;
          pos.quantity = fresh.quantity;
        }
      }
      if (changed) {
        await prisma.position.update({
          where: { id: pos.id },
          data: { takeProfits: JSON.stringify(tps) },
        }).catch(() => {}); // position may be fully closed already
      }

      // 6) Unrealized P&L bookkeeping event (kept sparse: only large moves).
      const unrealizedPct = ((price - pos.entryPriceUsd) / pos.entryPriceUsd) * 100;
      if (Math.abs(unrealizedPct) >= 25) {
        const last = await prisma.positionEvent.findFirst({
          where: { positionId: pos.id, kind: "NOTE" },
          orderBy: { createdAt: "desc" },
        });
        const lastPct = last?.payload ? JSON.parse(last.payload).unrealizedPct ?? 0 : 0;
        if (Math.abs(unrealizedPct - lastPct) >= 25) {
          await prisma.positionEvent.create({
            data: {
              positionId: pos.id, kind: "NOTE",
              message: `Unrealized P&L ${unrealizedPct.toFixed(0)}% (цена $${price.toPrecision(6)})`,
              payload: JSON.stringify({ unrealizedPct, price }),
            },
          });
        }
      }
    } catch (err) {
      await prisma.positionEvent.create({
        data: { positionId: pos.id, kind: "ALERT", message: `Ошибка мониторинга: ${String(err)}` },
      }).catch(() => {});
    }
  }
}
