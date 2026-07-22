import type { DataMode } from "./types";

export const config = {
  dataMode: (process.env.DATA_MODE === "mock" ? "mock" : "live") as DataMode,
  scanIntervalSec: intEnv("SCAN_INTERVAL_SEC", 60),
  monitorIntervalSec: intEnv("MONITOR_INTERVAL_SEC", 30),
  maxCandidatesPerCycle: intEnv("MAX_CANDIDATES_PER_CYCLE", 8),
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  birdeyeApiKey: process.env.BIRDEYE_API_KEY || null,
  heliusApiKey: process.env.HELIUS_API_KEY || null,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
  telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
};

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
