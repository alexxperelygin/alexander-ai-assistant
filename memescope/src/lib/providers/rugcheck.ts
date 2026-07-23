import type { ContractRiskReport, RiskFlag } from "../types";
import type { RiskProvider } from "./types";
import { fetchJson } from "./http";

// RugCheck public API (no key, be gentle). Docs: https://api.rugcheck.xyz/swagger/index.html
// Reports are cached by the caller (see scanner) to stay well under limits.

interface RcReport {
  token?: { mintAuthority?: string | null; freezeAuthority?: string | null };
  topHolders?: { pct?: number; insider?: boolean; owner?: string }[];
  risks?: { name?: string; description?: string; level?: string; score?: number }[];
  markets?: { lp?: { lpLockedPct?: number } }[];
  rugged?: boolean;
  score_normalised?: number;
  totalHolders?: number;
}

export class RugCheckRisk implements RiskProvider {
  readonly name = "rugcheck";

  async getRiskReport(mint: string): Promise<ContractRiskReport | null> {
    const r = await fetchJson<RcReport>(
      `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
      { source: this.name, minIntervalMs: 2000, timeoutMs: 15_000 },
    );
    if (!r || typeof r !== "object") return null;

    const holders = (r.topHolders ?? []).filter((h) => typeof h.pct === "number");
    const top10Pct = holders.slice(0, 10).reduce((s, h) => s + (h.pct ?? 0), 0);
    const insiderPct = holders.filter((h) => h.insider).reduce((s, h) => s + (h.pct ?? 0), 0);
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
    const high = top10Pct > 50 || flags.some((f) => f.severity === "danger");

    return {
      source: this.name,
      dataMode: "live",
      mintAuthority,
      freezeAuthority,
      top10Pct: holders.length ? top10Pct : undefined,
      insiderPct: holders.length ? insiderPct : undefined,
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
