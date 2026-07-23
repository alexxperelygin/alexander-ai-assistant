import { prisma } from "../db";

// Shared fetch wrapper: timeout, latency measurement, SourceHealth bookkeeping,
// and a naive per-source min-interval throttle so we respect public rate limits.

const lastCallAt = new Map<string, number>();

export interface HttpOpts {
  source: string; // health-tracking key, e.g. "dexscreener"
  minIntervalMs?: number; // simple throttle between calls to this source
  timeoutMs?: number;
}

export async function fetchJson<T>(url: string, opts: HttpOpts): Promise<T> {
  const { source, minIntervalMs = 0, timeoutMs = 10_000 } = opts;

  const last = lastCallAt.get(source) ?? 0;
  const wait = last + minIntervalMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt.set(source, Date.now());

  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", "user-agent": "memescope-ai-research/0.1" },
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      await recordHealth(source, { ok: false, latencyMs, error: `HTTP ${res.status} ${url}` });
      throw new Error(`${source}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as T;
    await recordHealth(source, { ok: true, latencyMs });
    return json;
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith(source))) {
      await recordHealth(source, {
        ok: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}

async function recordHealth(
  source: string,
  r: { ok: boolean; latencyMs: number; error?: string },
): Promise<void> {
  try {
    await prisma.sourceHealth.upsert({
      where: { source },
      create: {
        source,
        lastOkAt: r.ok ? new Date() : null,
        lastErrorAt: r.ok ? null : new Date(),
        lastError: r.error ?? null,
        latencyMs: r.latencyMs,
        okCount: r.ok ? 1 : 0,
        errorCount: r.ok ? 0 : 1,
      },
      update: r.ok
        ? { lastOkAt: new Date(), latencyMs: r.latencyMs, okCount: { increment: 1 } }
        : {
            lastErrorAt: new Date(),
            lastError: r.error ?? "unknown",
            latencyMs: r.latencyMs,
            errorCount: { increment: 1 },
          },
    });
  } catch {
    // Health bookkeeping must never break the data path.
  }
}
