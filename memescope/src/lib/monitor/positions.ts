import { prisma } from "../db";
import { getProviders } from "../providers";
import { notify } from "../notify/notifier";
import { sellPosition } from "../paper/portfolio";
import { FROZEN_EXIT, FREEZE_AT } from "../paper/exit-policy";

// Position monitoring pass: refresh market state for every open position,
// enforce stops / take-profits / liquidity-drain exits, and alert on risk
// changes. Runs from the worker every MONITOR_INTERVAL_SEC.

interface Tp { price: number; fraction: number; done: boolean }

/** Как часто повторять предупреждение об отсутствии цены. */
const STALE_ALERT_INTERVAL_MS = 3600_000;
/** Через сколько без цены позиция считается непригодной к сопровождению. */
const STALE_EXIT_MS = 6 * 3600_000;

/**
 * Что делать, когда источник перестал отдавать цену открытой позиции.
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
async function handleMissingPrice(positionId: string, tokenId: string): Promise<void> {
  const last = await prisma.tokenSnapshot.findFirst({
    where: { tokenId, priceUsd: { gt: 0 } },
    orderBy: { fetchedAt: "desc" },
  });
  const ageMs = last ? Date.now() - last.fetchedAt.getTime() : Infinity;

  if (last?.priceUsd != null && ageMs >= STALE_EXIT_MS) {
    const hours = Math.round(ageMs / 3600_000);
    await sellPosition({
      positionId, fraction: 1, priceUsd: last.priceUsd, liquidityUsd: last.liquidityUsd,
      reason: `Источник не отдаёт цену ${hours} ч — выход по последней известной цене ` +
        `$${last.priceUsd.toPrecision(6)} от ${last.fetchedAt.toISOString()}. ` +
        `Результат этой сделки НЕДОСТОВЕРЕН: реальная цена выхода неизвестна.`,
      kind: "CLOSE",
    }).catch(async (e) => notify("warning", "Закрытие по устаревшей цене не исполнено", String(e)));
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

export async function monitorPositionsOnce(): Promise<void> {
  const providers = getProviders();
  const open = await prisma.position.findMany({
    where: { status: { in: ["OPEN", "PARTIAL_EXIT"] } },
    include: { token: true },
  });

  for (const pos of open) {
    try {
      const snap = await providers.market.getMarketSnapshot(pos.token.mint);
      if (!snap || snap.priceUsd == null) {
        await handleMissingPrice(pos.id, pos.tokenId);
        continue;
      }
      const price = snap.priceUsd;
      const liq = snap.liquidityUsd ?? null;

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
      const peak = Math.max(pos.peakPriceUsd ?? pos.entryPriceUsd, price);
      if (peak > (pos.peakPriceUsd ?? 0)) {
        await prisma.position.update({ where: { id: pos.id }, data: { peakPriceUsd: peak } })
          .catch(() => {}); // позиция могла закрыться параллельно
      }

      // 1) Liquidity drain → emergency exit (rug in progress).
      if (entryLiq != null && liq != null && liq < entryLiq * FROZEN_EXIT.liquidityFloorRatio) {
        await sellPosition({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Ликвидность упала до $${Math.round(liq).toLocaleString()} (<${Math.round(FROZEN_EXIT.liquidityFloorRatio * 100)}% от входа) — аварийный выход`,
          kind: "STOP_HIT",
        }).catch(async (e) => notify("critical", "Аварийный выход не исполнен", String(e)));
        continue;
      }

      // 2) Stop-loss.
      if (pos.stopPriceUsd != null && price <= pos.stopPriceUsd) {
        await sellPosition({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Stop: цена $${price.toPrecision(6)} ≤ стопа $${pos.stopPriceUsd.toPrecision(6)}`,
          kind: "STOP_HIT",
        }).catch(async (e) => notify("critical", "Stop не исполнен", String(e)));
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
      const trailStop = peak * (1 - FROZEN_EXIT.trailPct);
      if (frozenRules && peak > pos.entryPriceUsd && price <= trailStop) {
        await sellPosition({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Трейлинг: цена $${price.toPrecision(6)} ≤ ${Math.round((1 - FROZEN_EXIT.trailPct) * 100)}% от максимума $${peak.toPrecision(6)}`,
          kind: "STOP_HIT",
        }).catch(async (e) => notify("critical", "Трейлинг не исполнен", String(e)));
        continue;
      }

      // 4) Предельный срок удержания. Без него позиция может висеть неделями:
      // проверка стратегии считает результат на горизонте 3 суток, и живой
      // портфель должен закрываться там же, иначе отчёт и портфель измеряют
      // разные вещи.
      const heldMin = (Date.now() - pos.openedAt.getTime()) / 60_000;
      if (frozenRules && heldMin >= FROZEN_EXIT.maxHoldMin) {
        await sellPosition({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Достигнут предельный срок удержания ${Math.round(FROZEN_EXIT.maxHoldMin / 1440)} сут — выход по времени`,
          kind: "CLOSE",
        }).catch(async (e) => notify("warning", "Выход по времени не исполнен", String(e)));
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
          await sellPosition({
            positionId: pos.id, fraction: fracOfRemaining, priceUsd: price, liquidityUsd: liq,
            reason: `Take-profit ${(tp.price / pos.entryPriceUsd).toFixed(1)}x достигнут`,
            kind: "TP_HIT",
          }).catch(async (e) => notify("warning", "TP не исполнен", String(e)));
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
