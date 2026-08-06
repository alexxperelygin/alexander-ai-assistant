import { describe, expect, it } from "vitest";
import { computeLpLockedPct, computeTop10Pct } from "../src/lib/providers/goplus";

describe("GoPlus holder statistics", () => {
  it("counts people, not pool contracts and lockers", () => {
    const top10 = computeTop10Pct([
      { percent: "0.40", is_contract: 1, tag: "Uniswap V3 pool" },
      { percent: "0.05", is_contract: 0 },
      { percent: "0.03", is_contract: 0 },
      { percent: "0.20", is_contract: 1, tag: "Team Finance Lock" },
    ]);
    // Только два настоящих держателя: 5% + 3%.
    expect(top10).toBeCloseTo(8);
  });

  it("reports unknown rather than a wrong number when the data looks polluted", () => {
    const top10 = computeTop10Pct([
      { percent: "0.99", is_contract: 0 },
      { percent: "0.50", is_contract: 0 },
    ]);
    expect(top10).toBeNull();
  });

  it("returns null when there are no holders at all", () => {
    expect(computeTop10Pct(undefined)).toBeNull();
    expect(computeTop10Pct([])).toBeNull();
  });

  it("sums only the locked share of LP", () => {
    expect(
      computeLpLockedPct([
        { percent: "0.70", is_locked: 1 },
        { percent: "0.30", is_locked: 0 },
      ]),
    ).toBeCloseTo(70);
    expect(computeLpLockedPct([])).toBeNull();
  });
});
