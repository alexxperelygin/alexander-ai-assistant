import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sellPosition } from "@/lib/paper/portfolio";

const schema = z.object({ fraction: z.number().min(0.01).max(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const pos = await prisma.position.findUnique({
      where: { id },
      include: { token: { include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } } },
    });
    if (!pos) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });
    const snap = pos.token.snapshots[0];
    if (!snap?.priceUsd) return NextResponse.json({ error: "Нет свежей цены для закрытия." }, { status: 400 });

    const updated = await sellPosition({
      positionId: id,
      fraction: parsed.data.fraction,
      priceUsd: snap.priceUsd,
      liquidityUsd: snap.liquidityUsd,
      reason: parsed.data.fraction >= 1 ? "Ручное закрытие пользователем" : "Ручная частичная фиксация",
      kind: "CLOSE",
    });
    return NextResponse.json({ ok: true, status: updated.status, realizedPnlUsd: updated.realizedPnlUsd });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
