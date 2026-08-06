import { describe, expect, it } from "vitest";
import { roundRobinByChain } from "../src/lib/ingestion/scanner";

const t = (chain: string, n: number) => ({ chain, id: `${chain}-${n}` });

describe("roundRobinByChain", () => {
  it("stops one chain from taking the whole budget", () => {
    // Discovery приносит по ~20 пулов из каждой сети, а Solana ещё и постоянный
    // поток: без чередования весь бюджет ушёл бы одной сети.
    const flood = [...Array(50)].map((_, i) => t("base", i));
    const few = [t("solana", 0), t("solana", 1)];
    const picked = roundRobinByChain([...flood, ...few], 6);
    expect(picked.filter((x) => x.chain === "solana")).toHaveLength(2);
    expect(picked.filter((x) => x.chain === "base")).toHaveLength(4);
  });

  it("keeps the order inside each chain", () => {
    const picked = roundRobinByChain(
      [t("solana", 0), t("solana", 1), t("bsc", 0), t("bsc", 1)],
      4,
    );
    expect(picked.map((x) => x.id)).toEqual(["solana-0", "bsc-0", "solana-1", "bsc-1"]);
  });

  it("uses the remaining budget when a chain runs out", () => {
    const picked = roundRobinByChain([t("solana", 0), t("bsc", 0), t("bsc", 1)], 10);
    expect(picked).toHaveLength(3);
  });

  it("handles an empty input", () => {
    expect(roundRobinByChain([], 5)).toEqual([]);
  });
});
