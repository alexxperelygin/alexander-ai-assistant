import { prisma } from "../db";
import { getRiskSettings } from "../settings";
import { notify } from "../notify/notifier";
import { simulateFill } from "./execution";
import { FROZEN_EXIT } from "./exit-policy";
import type { TradePlan } from "../types";

// Position lifecycle: open (paper or user-confirmed manual), partial exits,
// stops, close. Every mutation appends a PositionEvent (audit trail).

export interface OpenPositionArgs {
  tokenId: string;
  opportunityId?: string;
  mode: "paper" | "live"; // "live" = user actually bought manually; we only track
  priceUsd: number;
  sizeUsd: number;
  liquidityUsd: number | null;
  observedImpactPct?: number | null;
  plan?: TradePlan | null;
  // For live mode the user reports their actual fill:
  actualPriceUsd?: number;
  actualQuantity?: number;
  actualFeesUsd?: number;
}

export async function openPosition(args: OpenPositionArgs) {
  const settings = await getRiskSettings();

  // Risk-limit gates (paper and tracked-live alike).
  const open = await prisma.position.findMany({ where: { status: { in: ["OPEN", "PARTIAL_EXIT"] } } });
  const exposure = open.reduce((s, p) => s + p.remainingQty * p.entryPriceUsd, 0);
  if (args.mode === "paper" && !settings.paperTradingEnabled)
    throw new Error("Paper trading выключен в Settings.");
  if (args.sizeUsd > settings.maxPositionUsd)
    throw new Error(`Размер $${args.sizeUsd} превышает лимит позиции $${settings.maxPositionUsd}.`);
  if (exposure + args.sizeUsd > settings.maxTotalExposureUsd)
    throw new Error(`Суммарная экспозиция превысит лимит $${settings.maxTotalExposureUsd}.`);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const closedToday = await prisma.position.findMany({
    where: { closedAt: { gte: today } },
  });
  const lossToday = closedToday.reduce((s, p) => s + Math.min(0, p.realizedPnlUsd), 0);
  if (-lossToday >= settings.dailyLossLimitUsd)
    throw new Error(`Дневной лимит потерь $${settings.dailyLossLimitUsd} исчерпан — новые сделки заблокированы до завтра.`);

  // Cooldown after consecutive losses.
  const recent = await prisma.position.findMany({
    where: { status: { in: ["CLOSED", "STOPPED"] } },
    orderBy: { closedAt: "desc" },
    take: settings.cooldownAfterLosses,
  });
  if (
    recent.length >= settings.cooldownAfterLosses &&
    recent.every((p) => p.realizedPnlUsd < 0)
  ) {
    const last = recent[0]?.closedAt;
    if (last && Date.now() - last.getTime() < settings.cooldownMinutes * 60_000)
      throw new Error(
        `Cooldown: ${settings.cooldownAfterLosses} убыточных сделок подряд — пауза ${settings.cooldownMinutes} мин.`,
      );
  }

  let entryPriceUsd: number, quantity: number, feesUsd: number, slippagePct: number, costUsd: number;
  if (args.mode === "live") {
    if (!args.actualPriceUsd || !args.actualQuantity)
      throw new Error("Для live-позиции нужны фактические цена и количество.");
    entryPriceUsd = args.actualPriceUsd;
    quantity = args.actualQuantity;
    feesUsd = args.actualFeesUsd ?? 0;
    slippagePct = 0;
    costUsd = entryPriceUsd * quantity + feesUsd;
  } else {
    const fill = simulateFill({
      sideUsd: args.sizeUsd,
      priceUsd: args.priceUsd,
      liquidityUsd: args.liquidityUsd,
      direction: "buy",
      observedImpactPct: args.observedImpactPct,
    });
    if (!fill.executed) throw new Error(`Paper fill невозможен: ${fill.reason}`);
    entryPriceUsd = fill.effectivePriceUsd;
    quantity = fill.quantity;
    feesUsd = fill.feesUsd;
    slippagePct = fill.impactPct;
    costUsd = args.sizeUsd;
  }

  // Замороженные правила выхода, см. docs/PREREGISTRATION.md: жёсткий стоп
  // −20%, трейлинг 30% от максимума, лимит удержания 3 суток, аварийный выход
  // по обвалу ликвидности. Лесенки частичных фиксаций больше нет — измерение
  // показало, что она обрубает правый хвост и уводит результат к нулю.
  const stopPriceUsd = entryPriceUsd * (1 - FROZEN_EXIT.stopPct);
  const takeProfits = (args.plan?.takeProfitLevels ?? [])
    .map((tp) => ({ price: entryPriceUsd * tp.multiple, fraction: tp.sellFraction, done: false }));

  const pos = await prisma.position.create({
    data: {
      tokenId: args.tokenId,
      opportunityId: args.opportunityId,
      mode: args.mode,
      status: "OPEN",
      entryPriceUsd,
      quantity,
      costUsd,
      feesUsd,
      slippagePct,
      remainingQty: quantity,
      stopPriceUsd,
      peakPriceUsd: entryPriceUsd,
      takeProfits: JSON.stringify(takeProfits),
      invalidation: args.plan ? JSON.stringify(args.plan.invalidation) : null,
      events: {
        create: {
          kind: "OPEN",
          message: `${args.mode === "paper" ? "Paper" : "Live (ручная покупка)"} вход: ${quantity.toFixed(2)} шт по $${entryPriceUsd.toPrecision(6)} (комиссии $${feesUsd.toFixed(2)}, impact ${slippagePct.toFixed(2)}%)`,
          payload: JSON.stringify({ entryPriceUsd, quantity, feesUsd, slippagePct, costUsd }),
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: { actor: args.mode === "live" ? "user" : "system", action: "position.open", details: JSON.stringify({ positionId: pos.id, ...args }) },
  });
  await notify("info", `Открыта ${args.mode} позиция`, `Позиция ${pos.id} открыта: $${costUsd.toFixed(2)}.`);
  return pos;
}

export interface SellArgs {
  positionId: string;
  fraction: number; // 0..1 of remaining quantity
  priceUsd: number;
  liquidityUsd: number | null;
  reason: string;
  kind: "TP_HIT" | "STOP_HIT" | "CLOSE";
}

export async function sellPosition(args: SellArgs) {
  const pos = await prisma.position.findUniqueOrThrow({ where: { id: args.positionId } });
  if (pos.status === "CLOSED" || pos.status === "STOPPED") throw new Error("Позиция уже закрыта.");

  const qty = pos.remainingQty * Math.min(1, Math.max(0, args.fraction));
  const sideUsd = qty * args.priceUsd;
  const fill = simulateFill({
    sideUsd,
    priceUsd: args.priceUsd,
    liquidityUsd: args.liquidityUsd,
    direction: "sell",
  });
  if (!fill.executed) {
    await prisma.positionEvent.create({
      data: { positionId: pos.id, kind: "ALERT", message: `Продажа не исполнена: ${fill.reason}` },
    });
    throw new Error(`Продажа не исполнена: ${fill.reason}`);
  }

  const proceeds = qty * fill.effectivePriceUsd - fill.feesUsd;
  const costBasis = (qty / pos.quantity) * pos.costUsd;
  const pnl = proceeds - costBasis;
  const remainingQty = pos.remainingQty - qty;
  const fullyClosed = remainingQty <= pos.quantity * 0.001;

  const updated = await prisma.position.update({
    where: { id: pos.id },
    data: {
      remainingQty: fullyClosed ? 0 : remainingQty,
      realizedPnlUsd: pos.realizedPnlUsd + pnl,
      status: fullyClosed ? (args.kind === "STOP_HIT" ? "STOPPED" : "CLOSED") : "PARTIAL_EXIT",
      closedAt: fullyClosed ? new Date() : null,
      closeReason: fullyClosed ? args.reason : pos.closeReason,
      events: {
        create: {
          kind: args.kind,
          message: `${args.reason}: продано ${qty.toFixed(2)} шт по $${fill.effectivePriceUsd.toPrecision(6)}, P&L $${pnl.toFixed(2)}`,
          payload: JSON.stringify({ qty, price: fill.effectivePriceUsd, feesUsd: fill.feesUsd, pnl, impactPct: fill.impactPct }),
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: { actor: "system", action: "position.sell", details: JSON.stringify({ ...args, pnl }) },
  });
  await notify(
    pnl >= 0 ? "info" : "warning",
    fullyClosed ? "Позиция закрыта" : "Частичная фиксация",
    `${args.reason}. P&L этой продажи: $${pnl.toFixed(2)}. Realized total: $${updated.realizedPnlUsd.toFixed(2)}.`,
  );
  return updated;
}
