import { config } from "../lib/config";
import { prisma } from "../lib/db";
import { scanOnce } from "../lib/ingestion/scanner";
import { monitorPositionsOnce } from "../lib/monitor/positions";

// 24/7 worker: scan loop + position-monitor loop. Designed to run as a
// separate long-lived process (`npm run worker`). Interval-based scheduling
// keeps the MVP dependency-free; swap for BullMQ/Redis when scaling out
// (см. docs/ARCHITECTURE.md).

let stopping = false;

async function loop(name: string, intervalSec: number, fn: () => Promise<void>): Promise<void> {
  while (!stopping) {
    const started = Date.now();
    try {
      await fn();
    } catch (err) {
      console.error(`[${name}] cycle failed:`, err);
      await prisma.auditLog.create({
        data: { actor: "worker", action: `${name}.cycle.error`, details: String(err) },
      }).catch(() => {});
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
