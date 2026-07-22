import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_BACKTEST_PARAMS, runBacktest } from "@/lib/backtest/engine";
import { HORIZONS_MIN } from "@/lib/backtest/metrics";

const schema = z.object({
  horizon: z.string().refine((h) => h in HORIZONS_MIN, "unknown horizon"),
  dataMode: z.enum(["live", "mock"]).default("live"),
  positionUsd: z.number().positive().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const run = await runBacktest({
      ...DEFAULT_BACKTEST_PARAMS,
      horizon: parsed.data.horizon as keyof typeof HORIZONS_MIN,
      dataMode: parsed.data.dataMode,
      positionUsd: parsed.data.positionUsd ?? DEFAULT_BACKTEST_PARAMS.positionUsd,
    });
    return NextResponse.json({ ok: true, runId: run.id, status: run.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
