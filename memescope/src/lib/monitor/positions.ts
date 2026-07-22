import { prisma } from "../db";
import { getProviders } from "../providers";
import { notify } from "../notify/notifier";
import { sellPosition } from "../paper/portfolio";

// Position monitoring pass: refresh market state for every open position,
// enforce stops / take-profits / liquidity-drain exits, and alert on risk
// changes. Runs from the worker every MONITOR_INTERVAL_SEC.

interface Tp { price: number; fraction: number; done: boolean }

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
        await prisma.positionEvent.create({
          data: { positionId: pos.id, kind: "ALERT", message: "Нет свежих данных цены — мониторинг деградирован." },
        });
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

      // 1) Liquidity drain → emergency exit (rug in progress).
      if (entryLiq != null && liq != null && liq < entryLiq * 0.6) {
        await sellPosition({
          positionId: pos.id, fraction: 1, priceUsd: price, liquidityUsd: liq,
          reason: `Ликвидность упала до $${Math.round(liq).toLocaleString()} (<60% от входа) — аварийный выход`,
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

      // 3) Take-profit ladder.
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

      // 4) Unrealized P&L bookkeeping event (kept sparse: only large moves).
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
