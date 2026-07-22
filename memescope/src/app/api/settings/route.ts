import { NextResponse } from "next/server";
import { z } from "zod";
import { getRiskSettings, saveRiskSettings } from "@/lib/settings";

const schema = z.object({
  capitalUsd: z.number().positive(),
  maxRiskPerTradePct: z.number().min(0.1).max(100),
  maxPositionUsd: z.number().positive(),
  maxTotalExposureUsd: z.number().positive(),
  dailyLossLimitUsd: z.number().positive(),
  cooldownAfterLosses: z.number().int().min(1),
  cooldownMinutes: z.number().min(0),
  maxSlippagePct: z.number().min(0.1).max(50),
  maxPositionPctOfLiquidity: z.number().min(0.01).max(100),
  minLiquidityUsd: z.number().min(0),
  minTokenAgeMin: z.number().min(0),
  maxTokenAgeMin: z.number().positive(),
  signalsPaused: z.boolean(),
  liveTradingEnabled: z.boolean(),
  paperTradingEnabled: z.boolean(),
});

export async function GET() {
  return NextResponse.json(await getRiskSettings());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await saveRiskSettings(parsed.data);
  return NextResponse.json({ ok: true });
}
