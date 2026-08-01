import { describe, expect, it } from "vitest";
import { computeTopHolderStats } from "../src/lib/providers/rugcheck";

describe("computeTopHolderStats (holder concentration must ignore infrastructure)", () => {
  it("excludes AMM/LOCKER accounts labeled by address or owner", () => {
    const { top10Pct } = computeTopHolderStats(
      [
        { address: "amm", pct: 40 },
        { address: "locker", pct: 30 },
        { address: "w1", owner: "ammOwner", pct: 10 },
        { address: "w2", pct: 8 },
        { address: "w3", pct: 5 },
      ],
      {
        amm: { type: "AMM", name: "Raydium" },
        locker: { type: "LOCKER", name: "Lock" },
        ammOwner: { type: "AMM", name: "Pool authority" },
      },
    );
    expect(top10Pct).toBeCloseTo(13); // only w2 + w3 are people
  });

  it("keeps CREATOR holdings counted (real insider risk)", () => {
    const { top10Pct } = computeTopHolderStats(
      [
        { address: "creator", pct: 30 },
        { address: "w1", pct: 10 },
      ],
      { creator: { type: "CREATOR", name: "Creator" } },
    );
    expect(top10Pct).toBeCloseTo(40);
  });

  it("returns unknown (null) when sums are polluted above 95%", () => {
    // Unlabeled bonding-curve vault holding 80% + real holders → garbage sum.
    const { top10Pct } = computeTopHolderStats(
      [
        { address: "curve", pct: 80 },
        { address: "creator", pct: 17.3 },
        { address: "w1", pct: 5 },
      ],
      {},
    );
    expect(top10Pct).toBeNull();
  });

  it("sums insiders only over people", () => {
    const { insiderPct } = computeTopHolderStats(
      [
        { address: "amm", pct: 50, insider: true },
        { address: "w1", pct: 12, insider: true },
        { address: "w2", pct: 5 },
      ],
      { amm: { type: "AMM" } },
    );
    expect(insiderPct).toBeCloseTo(12);
  });

  it("handles empty input", () => {
    expect(computeTopHolderStats([], {})).toEqual({ top10Pct: null, insiderPct: null });
    expect(computeTopHolderStats(undefined, undefined)).toEqual({ top10Pct: null, insiderPct: null });
  });
});
