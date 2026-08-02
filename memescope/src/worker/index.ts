import { config } from "../lib/config";
import { prisma } from "../lib/db";
import { scanOnce } from "../lib/ingestion/scanner";
import { monitorPositionsOnce } from "../lib/monitor/positions";

// 24/7 worker: scan loop + position-monitor loop. Designed to run as a
// separate long-lived process (`npm run worker`). Interval-based scheduling
// keeps the MVP dependency-free; swap for BullMQ/Redis when scaling out
// (см. docs/ARCHITECTURE.md).

let stopping = false;

// Watchdog: a cycle that runs this long is considered hung (observed in prod:
// worker silently stalled ~hourly with no logged error). We exit(1) so pm2
// restarts the process with a clean slate instead of staying wedged forever.
const CYCLE_TIMEOUT_MS = 10 * 60_000;

async function withTimeout(fn: () => Promise<void>, name: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`WATCHDOG: ${name} cycle exceeded ${CYCLE_TIMEOUT_MS / 60000} min`)),
          CYCLE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loop(name: string, intervalSec: number, fn: () => Promise<void>): Promise<void> {
  while (!stopping) {
    const started = Date.now();
    try {
      await withTimeout(fn, name);
    } catch (err) {
      console.error(`[${name}] cycle failed:`, err);
      await prisma.auditLog.create({
        data: { actor: "worker", action: `${name}.cycle.error`, details: String(err) },
      }).catch(() => {});
      if (String(err).includes("WATCHDOG")) {
        // Hung cycle: restart the whole process (pm2 brings us back).
        process.exit(1);
      }
    }
    const elapsed = Date.now() - started;
    const wait = Math.max(1000, intervalSec * 1000 - elapsed);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function main(): Promise<void> {
  console.log(
    `MemeScope worker starting: dataMode=${config.dataMode.toUpperCase()}, scan=${config.scanIntervalSec}s, monitor=${config.monitorIntervalSec}s`,
  );
  if (config.dataMode === "mock") {
    console.log("⚠️  MOCK MODE: все данные вымышленные, помечены dataMode=mock.");
  }
  await prisma.auditLog.create({
    data: { actor: "worker", action: "worker.start", details: JSON.stringify({ dataMode: config.dataMode }) },
  });

  await Promise.all([
    loop("scan", config.scanIntervalSec, async () => {
      const r = await scanOnce();
      console.log(`[scan] discovered=${r.discovered} evaluated=${r.evaluated}`);
    }),
    loop("monitor", config.monitorIntervalSec, monitorPositionsOnce),
  ]);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received, stopping after current cycle...`);
    stopping = true;
  });
}

main().catch((err) => {
  console.error("worker fatal:", err);
  process.exit(1);
});
