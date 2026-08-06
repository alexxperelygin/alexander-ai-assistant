import { describe, expect, it } from "vitest";
import { CHAINS, chainCanSignal, chainConfig, enabledChains } from "../src/lib/chains";
import { evaluateHardRejections } from "../src/lib/risk/engine";
import { DEFAULT_RISK_SETTINGS, type FeatureVector } from "../src/lib/types";

function healthyFeatures(): FeatureVector {
  return {
    computedAt: new Date(), tokenAgeMin: 120, priceUsd: 0.0001, liquidityUsd: 80_000,
    fdvUsd: 900_000, marketCapUsd: 800_000, volume1hUsd: 60_000, volume24hUsd: 300_000,
    volAccel: 2, buySellRatio1h: 1.5, txns1h: 400, priceChange1h: 20, priceChange24h: 60,
    volToLiq: 4, fdvToLiq: 11, holders: 1000, top10Pct: 25, lpLockedPct: 100,
    mintAuthorityActive: false, freezeAuthorityActive: false, rugged: false,
    sellRouteOk: true, sellImpactPct: 1, liqTrendPct: 0, hasSocials: true, dataGaps: [],
  };
}

describe("chain registry", () => {
  it("only lets a chain signal when its contracts can be checked", () => {
    expect(chainCanSignal("solana")).toBe(true);  // RugCheck
    expect(chainCanSignal("base")).toBe(true);    // GoPlus
    expect(chainCanSignal("does-not-exist")).toBe(false);
  });

  it("covers Robinhood Chain end to end", () => {
    const rh = chainConfig("robinhood");
    expect(rh?.geckoNetwork).toBe("robinhood");
    expect(rh?.goplusChainId).toBe("4663");
    expect(chainCanSignal("robinhood")).toBe(true);
  });

  it("maps chains to their GeckoTerminal network id", () => {
    expect(chainConfig("ethereum")?.geckoNetwork).toBe("eth");
    expect(chainConfig("solana")?.geckoNetwork).toBe("solana");
  });

  it("falls back to every known chain, and ignores typos in SCAN_CHAINS", () => {
    expect(enabledChains("").length).toBe(Object.keys(CHAINS).length);
    expect(enabledChains("base,bsc").map((c) => c.id)).toEqual(["base", "bsc"]);
    // Полностью нераспознанный список не должен обнулять сканирование.
    expect(enabledChains("nonsense").map((c) => c.id)).toEqual(["solana"]);
  });
});

describe("signal gating by chain", () => {

  it("does not block an otherwise healthy Solana token", () => {
    const rules = evaluateHardRejections(healthyFeatures(), null, DEFAULT_RISK_SETTINGS, {
      chain: "solana",
    }).map((r) => r.rule);
    expect(rules).not.toContain("no-contract-risk-source");
    expect(rules).not.toContain("unknown-chain");
  });

  it("blocks an unknown chain outright", () => {
    const rules = evaluateHardRejections(healthyFeatures(), null, DEFAULT_RISK_SETTINGS, {
      chain: "bitcoin",
    }).map((r) => r.rule);
    expect(rules).toContain("unknown-chain");
  });
});

describe("chains without a route simulator", () => {
  it("refuses to signal unless the contract check confirmed sellability", () => {
    // Base не симулирует продажу: подтверждение может дать только проверка контракта.
    const unconfirmed = evaluateHardRejections(
      { ...healthyFeatures(), sellRouteOk: null },
      null,
      DEFAULT_RISK_SETTINGS,
      { chain: "base" },
    ).map((r) => r.rule);
    expect(unconfirmed).toContain("sell-not-verified");

    const confirmed = evaluateHardRejections(
      { ...healthyFeatures(), sellRouteOk: true },
      null,
      DEFAULT_RISK_SETTINGS,
      { chain: "base" },
    ).map((r) => r.rule);
    expect(confirmed).not.toContain("sell-not-verified");
  });

  it("no longer blocks EVM chains for lack of a contract-risk source", () => {
    const rules = evaluateHardRejections(healthyFeatures(), null, DEFAULT_RISK_SETTINGS, {
      chain: "base",
    }).map((r) => r.rule);
    expect(rules).not.toContain("no-contract-risk-source");
  });
});
