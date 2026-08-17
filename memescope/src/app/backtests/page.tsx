import { prisma } from "@/lib/db";
import { Card, Empty, fmtPct, timeAgo } from "@/components/ui";
import { RunBacktest } from "@/components/RunBacktest";
import type { AggregateMetrics } from "@/lib/backtest/metrics";

export const dynamic = "force-dynamic";

interface RunMetrics {
  strategy: AggregateMetrics;
  baseline: AggregateMetrics;
  verdict: string;
}

export default async function BacktestsPage() {
  const runs = await prisma.backtestRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--txt)" }}>Проверка гипотез</h1>
        <p className="text-[11px]" style={{ color: "var(--txt-dim)" }}>прогон стратегии по истории наблюдений</p>
      </div>
      <p className="max-w-3xl text-xs text-zinc-500">
        Backtest считается по данным, которые собрала сама система (без look-ahead: вход по последнему
        снапшоту до сигнала, исход — только по последующим снапшотам, издержки — комиссия DEX +
        сеть + price impact + дрейф задержки). Меньше 20 сигналов → честный NO_DATA. Методология:
        docs/BACKTEST_METHODOLOGY.md.
      </p>
      <Card title="Новый запуск"><RunBacktest /></Card>

      {runs.length === 0 ? (
        <Card title="Результаты"><Empty text="Запусков ещё не было" /></Card>
      ) : (
        runs.map((run) => {
          const m = parseMetrics(run.metrics);
          const params = safeParse(run.params);
          return (
            <Card
              key={run.id}
              title={`${run.status} · горизонт ${params?.horizon ?? "?"} · ${params?.dataMode ?? "?"} · ${timeAgo(run.createdAt)} назад`}
            >
              <p className={`mb-3 text-sm font-medium ${verdictColor(run.notes)}`}>{run.notes}</p>
              {m && (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th></th><th>Сигналов</th><th>Оценимо</th><th>Win rate</th><th>Expectancy</th>
                        <th>Median</th><th>Profit factor</th><th>Max DD</th><th>Rug rate</th><th>Незакрываемых</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["strategy", "baseline"] as const).map((k) => {
                        const a = m[k];
                        return (
                          <tr key={k}>
                            <td className="font-medium">{k === "strategy" ? "Стратегия (READY)" : "Baseline (всё подряд)"}</td>
                            <td>{a.signals}</td>
                            <td>{a.evaluable}</td>
                            <td>{a.winRate == null ? "—" : `${(a.winRate * 100).toFixed(0)}%`}</td>
                            <td className={a.expectancy != null && a.expectancy > 0 ? "text-emerald-400" : "text-red-400"}>
                              {a.expectancy == null ? "—" : fmtPct(a.expectancy * 100)}
                            </td>
                            <td>{a.medianReturn == null ? "—" : fmtPct(a.medianReturn * 100)}</td>
                            <td>{a.profitFactor == null ? "—" : a.profitFactor === Infinity ? "∞" : a.profitFactor.toFixed(2)}</td>
                            <td>{a.maxDrawdown == null ? "—" : `${(a.maxDrawdown * 100).toFixed(0)}%`}</td>
                            <td>{a.rugRate == null ? "—" : `${(a.rugRate * 100).toFixed(0)}%`}</td>
                            <td>{`${(a.unclosablePct * 100).toFixed(0)}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {Object.keys(m.strategy.byMonth).length > 0 && (
                    <div className="mt-2 text-xs text-zinc-400">
                      По месяцам:{" "}
                      {Object.entries(m.strategy.byMonth)
                        .map(([mo, v]) => `${mo}: ${v.n} сигн., ср. ${fmtPct(v.meanReturn * 100)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function parseMetrics(s: string | null): RunMetrics | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
function safeParse(s: string): { horizon?: string; dataMode?: string } | null {
  try { return JSON.parse(s); } catch { return null; }
}
function verdictColor(notes: string | null): string {
  if (!notes) return "text-zinc-400";
  if (notes.startsWith("PRELIMINARY EDGE")) return "text-emerald-400";
  if (notes.startsWith("NO EDGE")) return "text-red-400";
  return "text-amber-400";
}
