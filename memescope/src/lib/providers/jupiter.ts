import { SOL_MINT } from "../config";
import type { RouteQuote } from "../types";
import type { RouteProvider } from "./types";
import { fetchJson } from "./http";

// Jupiter lite API (no key, ~1 rps). Docs: https://dev.jup.ag/docs/
// The sell-direction quote doubles as a sellability check: if the aggregator
// cannot build token→SOL route, the position could not be exited.

const LAMPORTS_PER_SOL = 1_000_000_000;

interface JupQuote {
  outAmount?: string;
  priceImpactPct?: string;
  routePlan?: unknown[];
  error?: string;
}

interface JupPriceV3 {
  [mint: string]: { usdPrice?: number } | undefined;
}

export class JupiterRoutes implements RouteProvider {
  readonly name = "jupiter";

  async getQuote(
    mint: string,
    direction: "buy" | "sell",
    amountUsd: number,
  ): Promise<RouteQuote | null> {
    // Convert USD size to lamports via current SOL price.
    const priceJson = await fetchJson<JupPriceV3>(
      `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`,
      { source: this.name, minIntervalMs: 1100 },
    );
    const solUsd = priceJson[SOL_MINT]?.usdPrice;
    if (!solUsd || solUsd <= 0) return null;

    let inputMint: string, outputMint: string, amount: number;
    if (direction === "buy") {
      inputMint = SOL_MINT;
      outputMint = mint;
      amount = Math.max(1, Math.round((amountUsd / solUsd) * LAMPORTS_PER_SOL));
    } else {
      // For sell we first quote a buy to learn how many token units amountUsd is,
      // then quote selling those units back.
      const buy = await this.rawQuote(SOL_MINT, mint,
        Math.max(1, Math.round((amountUsd / solUsd) * LAMPORTS_PER_SOL)));
      const units = buy?.outAmount ? parseInt(buy.outAmount, 10) : 0;
      if (!units) {
        return { source: this.name, dataMode: "live", direction, inAmountUsd: amountUsd, routeFound: false };
      }
      inputMint = mint;
      outputMint = SOL_MINT;
      amount = units;
    }

    const q = await this.rawQuote(inputMint, outputMint, amount);
    if (!q || q.error || !q.outAmount) {
      return { source: this.name, dataMode: "live", direction, inAmountUsd: amountUsd, routeFound: false, raw: q ?? undefined };
    }
    const impactRaw = q.priceImpactPct ? Math.abs(parseFloat(q.priceImpactPct)) * 100 : NaN;
    return {
      source: this.name,
      dataMode: "live",
      direction,
      inAmountUsd: amountUsd,
      // NaN/Infinity must never leak into features/DB — undefined means "unknown".
      priceImpactPct: Number.isFinite(impactRaw) ? impactRaw : undefined,
      routeFound: true,
      raw: { routes: q.routePlan?.length ?? 0 },
    };
  }

  private async rawQuote(inputMint: string, outputMint: string, amount: number): Promise<JupQuote | null> {
    try {
      return await fetchJson<JupQuote>(
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=300`,
        { source: this.name, minIntervalMs: 1100 },
      );
    } catch {
      return null; // "no route" often comes back as HTTP 400
    }
  }
}
