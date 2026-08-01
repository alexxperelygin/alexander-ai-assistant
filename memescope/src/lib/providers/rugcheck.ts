import type { ContractRiskReport, RiskFlag } from "../types";
import type { RiskProvider } from "./types";
import { fetchJson } from "./http";

// RugCheck public API (no key, be gentle). Docs: https://api.rugcheck.xyz/swagger/index.html
// Reports are cached by the caller (see scanner) to stay well under limits.

interface RcHolder {
  address?: string;
  pct?: number;
  insider?: boolean;
  owner?: string;
}

interface RcReport {
  token?: { mintAuthority?: string | null; freezeAuthority?: string | null };
  topHolders?: RcHolder[];
  knownAccounts?: Record<string, { name?: string; type?: string }>;
  risks?: { name?: string; description?: string; level?: string; score?: number }[];
  markets?: { lp?: { lpLockedPct?: number } }[];
  rugged?: boolean;
  score_normalised?: number;
  totalHolders?: number;
}

// Holder-concentration must count PEOPLE, not infrastructure: AMM vaults,
// lockers and LP accounts routinely "hold" most of the supply and are labeled
// in knownAccounts. Counting them made top-10 exceed 60% for nearly every
// token and hard-rejected the whole market.
const INFRA_ACCOUNT_TYPES = new Set(["AMM", "LOCKER", "LP", "POOL", "DEX"]);

/** Exported for unit tests. Returns null when data looks polluted (sum>95%). */
export function computeTopHolderStats(
  topHolders: RcHolder[] | undefined,
  knownAccounts: RcReport["knownAccounts"],
): { top10Pct: number | null; insiderPct: number | null } {
  const holders = (topHolders ?? []).filter((h) => typeof h.pct === "number");
  if (holders.length === 0) return { top10Pct: null, insiderPct: null };
  const isInfra = (h: RcHolder): boolean => {
    const byAddr = h.address ? knownAccounts?.[h.address] : undefined;
    const byOwner = h.owner ? knownAccounts?.[h.owner] : undefined;
    const type = (byAddr?.type ?? byOwner?.type ?? "").toUpperCase();
    return INFRA_ACCOUNT_TYPES.has(type);
  };
  const people = holders.filter((h) => !isInfra(h));
  const top10Pct = people.slice(0, 10).reduce((s, h) => s + (h.pct ?? 0), 0);
  const insiderPct = people.filter((h) => h.insider).reduce((s, h) => s + (h.pct ?? 0), 0);
  // Sums above ~95% mean unlabeled pool/curve accounts still pollute the list
  // (real distributions double-count supply there) — report "unknown" instead
  // of hard-rejecting on garbage.
  if (top10Pct > 95) return { top10Pct: null, insiderPct: insiderPct > 95 ? null : insiderPct };
  return { top10Pct, insiderPct };
}

export class RugCheckRisk implements RiskProvider {
  readonly name = "rugcheck";

  async getRiskReport(mint: string): Promise<ContractRiskReport | null> {
    const r = await fetchJson<RcReport>(
      `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
      { source: this.name, minIntervalMs: 2000, timeoutMs: 15_000 },
    );
    if (!r || typeof r !== "object") return null;

    const { top10Pct, insiderPct } = computeTopHolderStats(r.topHolders, r.knownAccounts);
    const lpLockedPct = r.markets?.[0]?.lp?.lpLockedPct;

    const flags: RiskFlag[] = (r.risks ?? []).map((risk) => ({
      name: risk.name ?? "unknown",
      severity: mapLevel(risk.level),
      description: risk.description ?? "",
    }));

    const mintAuthority = r.token ? r.token.mintAuthority != null : undefined;
    const freezeAuthority = r.token ? r.token.freezeAuthority != null : undefined;

    const critical =
      r.rugged === true || mintAuthority === true || freezeAuthority === true ||
      flags.some((f) => f.severity === "critical");
    const high = (top10Pct != null && top10Pct > 50) || flags.some((f) => f.severity === "danger");

    return {
      source: this.name,
      dataMode: "live",
      mintAuthority,
      freezeAuthority,
      top10Pct: top10Pct ?? undefined,
      insiderPct: insiderPct ?? undefined,
      lpLockedPct,
      rugged: r.rugged,
      riskLevel: critical ? "critical" : high ? "high" : flags.length > 2 ? "medium" : "low",
      flags,
      raw: { score_normalised: r.score_normalised, totalHolders: r.totalHolders },
    };
  }
}

function mapLevel(level?: string): RiskFlag["severity"] {
  switch ((level ?? "").toLowerCase()) {
    case "danger":
      return "danger";
    case "warn":
    case "warning":
      return "warning";
    case "crit":
    case "critical":
      return "critical";
    default:
      return "info";
  }
}
