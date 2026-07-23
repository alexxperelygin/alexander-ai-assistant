import { DEFAULT_BACKTEST_PARAMS, runBacktest } from "./engine";
import { HORIZONS_MIN } from "./metrics";

// CLI: npm run backtest -- [--horizon 24h] [--mode live|mock] [--position 50]

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const horizon = get("--horizon") ?? DEFAULT_BACKTEST_PARAMS.horizon;
  if (!(horizon in HORIZONS_MIN)) {
    console.error(`Unknown horizon "${horizon}". Use one of: ${Object.keys(HORIZONS_MIN).join(", ")}`);
    process.exit(1);
  }
  const mode = get("--mode") === "mock" ? "mock" : "live";
  const position = parseFloat(get("--position") ?? "") || DEFAULT_BACKTEST_PARAMS.positionUsd;

  console.log(`Running backtest: horizon=${horizon}, dataMode=${mode}, position=$${position}`);
  const run = await runBacktest({
    ...DEFAULT_BACKTEST_PARAMS,
    horizon: horizon as keyof typeof HORIZONS_MIN,
    dataMode: mode,
    positionUsd: position,
  });
  console.log(`Status: ${run.status}`);
  console.log(run.notes);
  if (run.metrics) console.log(JSON.stringify(JSON.parse(run.metrics), null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
