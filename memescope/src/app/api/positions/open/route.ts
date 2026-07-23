import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { openPosition } from "@/lib/paper/portfolio";
import type { TradePlan } from "@/lib/types";

const schema = z.object({
  opportunityId: z.string(),
  mode: z.enum(["paper", "live"]),
  sizeUsd: z.number().positive().optional(),
  actualPriceUsd: z.number().positive().optional(),
  actualQuantity: z.number().positive().optional(),
  actualFeesUsd: z.number().min(0).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const args = parsed.data;

  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: args.opportunityId },
      include: { token: { include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } } },
    });
    if (!opp) return NextResponse.json({ error: "Opportunity не найдена" }, { status: 404 });
    if (opp.rejections) {
      return NextResponse.json({ error: "Есть hard-rejection риски — открытие запрещено." }, { status: 400 });
    }
    const snap = opp.token.snapshots[0];
    if (!snap?.priceUsd) {
      return NextResponse.json({ error: "Нет свежей цены — открытие невозможно." }, { status: 400 });
    }
    // Stale-data guard: refuse to act on data older than 10 minutes.
    if (Date.now() - snap.fetchedAt.getTime() > 10 * 60_000) {
      return NextResponse.json({ error: "Данные старше 10 минут — обнови сканер перед входом." }, { status: 400 });
    }
    const plan: TradePlan | null = opp.plan ? JSON.parse(opp.plan) : null;

    const pos = await openPosition({
      tokenId: opp.tokenId,
      opportunityId: opp.id,
      mode: args.mode,
      priceUsd: snap.priceUsd,
      sizeUsd: args.sizeUsd ?? plan?.positionSizeUsd ?? 0,
      liquidityUsd: snap.liquidityUsd,
      plan,
      actualPriceUsd: args.actualPriceUsd,
      actualQuantity: args.actualQuantity,
      actualFeesUsd: args.actualFeesUsd,
    });

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { status: args.mode === "paper" ? "HOLD" : "BUY" },
    });
    await prisma.signalEvent.create({
      data: {
        opportunityId: opp.id,
        fromStatus: opp.status,
        toStatus: args.mode === "paper" ? "HOLD" : "BUY",
        reason: args.mode === "paper" ? "Открыта paper-позиция" : "Пользователь подтвердил ручную покупку (I bought)",
      },
    });
    return NextResponse.json({ ok: true, positionId: pos.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
