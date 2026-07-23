import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, DataModeBadge, Empty, ScoreBar, StatusBadge, fmtUsd, timeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS = ["ALL", "READY", "CANDIDATE", "WATCH", "AVOID", "DATA_UNAVAILABLE"] as const;

export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.includes((status ?? "ALL") as (typeof FILTERS)[number])
    ? (status ?? "ALL")
    : "ALL";

  const opps = await prisma.opportunity.findMany({
    where: filter === "ALL" ? {} : { status: filter },
    include: { token: { include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Live Scanner</h1>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/scanner" : `/scanner?status=${f}`}
            className={`rounded px-2 py-1 text-xs ${filter === f ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
          >
            {f.replace("_", " ")}
          </Link>
        ))}
      </div>

      <Card title={`Поток монет (${opps.length})`}>
        {opps.length === 0 ? (
          <Empty text="Нет записей под фильтр. Worker запущен? (npm run worker)" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Токен</th><th>Статус</th><th>Score</th><th>Risk</th>
                <th>Возраст</th><th>Ликвидность</th><th>Vol 24h</th><th>Vol accel</th>
                <th>Риски</th><th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => {
                const f = safeJson(o.featuresRef);
                const risks = safeJson(o.risks) as { severity?: string }[] | null;
                const dangerCount = Array.isArray(risks)
                  ? risks.filter((r) => r.severity === "danger" || r.severity === "critical").length
                  : 0;
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/opportunity/${o.id}`} className="text-sky-400 hover:underline">
                        {o.token.symbol}
                      </Link>{" "}
                      <DataModeBadge mode={o.dataMode} />
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><ScoreBar value={o.opportunityScore} /></td>
                    <td><ScoreBar value={o.riskScore} danger /></td>
                    <td className="text-xs">{ageFromMin(f?.tokenAgeMin)}</td>
                    <td>{fmtUsd(f?.liquidityUsd)}</td>
                    <td>{fmtUsd(f?.volume24hUsd)}</td>
                    <td className="text-xs tabular-nums">
                      {typeof f?.volAccel === "number" ? `${f.volAccel.toFixed(1)}×` : "—"}
                    </td>
                    <td className="text-xs">
                      {dangerCount > 0 ? <span className="text-red-400">{dangerCount} ⚠</span> : "—"}
                    </td>
                    <td className="text-xs text-zinc-500">{timeAgo(o.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function safeJson(s: string | null): Record<string, unknown> & { tokenAgeMin?: number; liquidityUsd?: number; volume24hUsd?: number; volAccel?: number } | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function ageFromMin(min: unknown): string {
  if (typeof min !== "number") return "—";
  if (min < 60) return `${Math.round(min)}м`;
  if (min < 1440) return `${(min / 60).toFixed(1)}ч`;
  return `${(min / 1440).toFixed(1)}д`;
}
