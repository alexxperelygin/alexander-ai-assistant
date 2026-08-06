import type {
  ContractRiskReport,
  DiscoveredToken,
  MarketSnapshot,
  RouteQuote,
} from "../types";
import type {
  DiscoveryProvider,
  MarketDataProvider,
  RiskProvider,
  RouteProvider,
} from "./types";

// Deterministic mock provider for development and tests. All tokens are
// FICTIONAL, symbols are prefixed with "MOCK", and every payload is labeled
// dataMode="mock". Values are seeded from (mint, 5-minute time bucket) so runs
// are reproducible while still evolving over time. This provider must never be
// presented as real market data.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random in [0,1) from a string seed. */
function rand(seed: string): number {
  return hash(seed) / 0xffffffff;
}

function bucket(now: Date): number {
  return Math.floor(now.getTime() / (5 * 60 * 1000));
}

const CAST = [
  { mint: "MockMint1111111111111111111111111111111111A", symbol: "MOCKDOG", profile: "healthy" },
  { mint: "MockMint1111111111111111111111111111111111B", symbol: "MOCKCAT", profile: "healthy" },
  { mint: "MockMint1111111111111111111111111111111111C", symbol: "MOCKRUG", profile: "rug" },
  { mint: "MockMint1111111111111111111111111111111111D", symbol: "MOCKPUMP", profile: "late-pump" },
  { mint: "MockMint1111111111111111111111111111111111E", symbol: "MOCKTHIN", profile: "illiquid" },
  { mint: "MockMint1111111111111111111111111111111111F", symbol: "MOCKFRESH", profile: "too-new" },
] as const;

type Profile = (typeof CAST)[number]["profile"];

function profileOf(mint: string): Profile {
  return CAST.find((c) => c.mint === mint)?.profile ?? "healthy";
}

export class MockProvider
  implements DiscoveryProvider, MarketDataProvider, RiskProvider, RouteProvider
{
  readonly name = "mock";
  constructor(private now: () => Date = () => new Date()) {}

  async discoverNewTokens(): Promise<DiscoveredToken[]> {
    const t = this.now();
    return CAST.map((c) => ({
      chain: "solana",
      mint: c.mint,
      symbol: c.symbol,
      name: `${c.symbol} (fictional mock token)`,
      pairAddress: `mockpair-${c.symbol}`,
      dex: "mock-dex",
      pairCreatedAt: new Date(
        t.getTime() -
          (c.profile === "too-new" ? 5 : 60 + Math.floor(rand(c.mint) * 600)) * 60_000,
      ),
    }));
  }

  async getMarketSnapshot(mint: string): Promise<MarketSnapshot | null> {
    const t = this.now();
    const b = bucket(t);
    const p = profileOf(mint);
    const r = (k: string) => rand(`${mint}:${b}:${k}`);

    const base: MarketSnapshot = {
      source: this.name,
      dataMode: "mock",
      observedAt: t,
      priceUsd: 0.000001 * (1 + r("p") * 50),
      liquidityUsd: 15_000 + r("l") * 120_000,
      fdvUsd: 100_000 + r("f") * 2_000_000,
      marketCapUsd: 80_000 + r("m") * 1_500_000,
      volume5mUsd: 2_000 + r("v5") * 20_000,
      volume1hUsd: 20_000 + r("v1") * 150_000,
      volume24hUsd: 100_000 + r("v24") * 900_000,
      buys5m: 10 + Math.floor(r("b5") * 80),
      sells5m: 8 + Math.floor(r("s5") * 60),
      buys1h: 100 + Math.floor(r("b1") * 700),
      sells1h: 90 + Math.floor(r("s1") * 500),
      priceChange5m: (r("c5") - 0.4) * 20,
      priceChange1h: (r("c1") - 0.4) * 60,
      priceChange24h: (r("c24") - 0.35) * 200,
      holders: 150 + Math.floor(r("h") * 3000),
    };

    if (p === "illiquid") {
      base.liquidityUsd = 800 + r("l2") * 2_000;
      base.volume24hUsd = 500 + r("v") * 3_000;
    }
    if (p === "late-pump") {
      base.priceChange24h = 400 + r("lp") * 900; // already 5x-13x — likely too late
      base.priceChange1h = 5 + r("lp1") * 10;
      base.volume5mUsd = 500 + r("lp5") * 2_000; // volume fading
    }
    if (p === "rug") {
      base.liquidityUsd = 30_000 - (b % 10) * 2_500; // liquidity draining each bucket
    }
    return base;
  }

  async getRiskReport(mint: string): Promise<ContractRiskReport | null> {
    const p = profileOf(mint);
    const base: ContractRiskReport = {
      source: this.name,
      dataMode: "mock",
      mintAuthority: false,
      freezeAuthority: false,
      top10Pct: 18 + rand(`${mint}:t10`) * 15,
      insiderPct: rand(`${mint}:ins`) * 8,
      lpLockedPct: 95,
      rugged: false,
      sellRouteOk: true,
      sellImpactPct: 1 + rand(`${mint}:imp`) * 2,
      riskLevel: "low",
      flags: [],
    };
    if (p === "rug") {
      return {
        ...base,
        mintAuthority: true,
        top10Pct: 78,
        lpLockedPct: 0,
        riskLevel: "critical",
        flags: [
          { name: "mint-authority", severity: "critical", description: "Mint authority still active (mock)" },
          { name: "top10-concentration", severity: "danger", description: "Top-10 hold 78% of supply (mock)" },
        ],
      };
    }
    if (p === "illiquid") {
      return {
        ...base,
        sellImpactPct: 35,
        riskLevel: "high",
        flags: [{ name: "thin-liquidity", severity: "danger", description: "Pool too thin to exit (mock)" }],
      };
    }
    return base;
  }

  async getQuote(mint: string, direction: "buy" | "sell", amountUsd: number): Promise<RouteQuote> {
    const p = profileOf(mint);
    const impact =
      p === "illiquid" ? 25 + rand(`${mint}:qi`) * 30 : 0.3 + rand(`${mint}:q`) * 2;
    return {
      source: this.name,
      dataMode: "mock",
      direction,
      inAmountUsd: amountUsd,
      priceImpactPct: impact,
      routeFound: p !== "rug" || direction === "buy", // rug: buy works, sell does not
    };
  }
}
