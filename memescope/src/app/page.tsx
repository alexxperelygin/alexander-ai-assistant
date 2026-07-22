import Link from "next/link";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { Card, DataModeBadge, Empty, ScoreBar, StatusBadge, fmtUsd, timeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const [lastScan, topOpps, openPositions, notifications, todayClosed, sources] =
    await Promise.all([
      prisma.auditLog.findFirst({ where: { action: "scan.cycle" }, orderBy: { createdAt: "desc" } }),
      prisma.opportunity.findMany({
        where: { status: { in: ["READY", "CANDIDATE", "WATCH"] } },
        include: { token: true },
        orderBy: { opportunityScore: "desc" },
        take: 8,
      }),
      prisma.position.findMany({
        where: { status: { in: ["OPEN", "PARTIAL_EXIT"] } },
        include: { token: true },
        take: 10,
      }),
      prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.position.findMany({
        where: { closedAt: { gte: startOfToday() } },
      }),
      prisma.sourceHealth.findMany(),
    ]);

  const scanInfo = lastScan?.details ? JSON.parse(lastScan.details) : null;
  const scanAge = lastScan ? Date.now() - lastScan.createdAt.getTime() : null;
  const scannerOk = scanAge != null && scanAge < config.scanIntervalSec * 3000;
  const dayPnl = todayClosed.reduce((s, p) => s + p.realizedPnlUsd, 0);
  const badSources = sources.filter(
    (s) => s.lastErrorAt && (!s.lastOkAt || s.lastErrorAt > s.lastOkAt),
  );

  // Market regime from the most recent SOL-bearing snapshot is intentionally
  // not recomputed here; the scanner stores it per opportunity in scores.
  const solRegime = topOpps[0] ? safeRegime(topOpps[0].scores) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Overview</h1>
        <DataModeBadge mode={config.dataMode} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card">
          <div className="stat-label">Сканер</div>
          <div className={`text-lg font-semibold ${scannerOk ? "text-emerald-400" : "text-red-400"}`}>
            {scannerOk ? "работает" : "остановлен"}
          </div>
          <div className="text-xs text-zinc-500">
            {lastScan ? `цикл ${timeAgo(lastScan.createdAt)} назад · оценено ${scanInfo?.evaluated ?? "?"}` : "ещё не запускался — npm run worker"}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Рыночный режим (SOL 24ч)</div>
          <div className="text-lg font-semibold">{solRegime ?? "нет данных"}</div>
        </div>
        <div className="card">
          <div className="stat-label">Дневной результат (paper)</div>
          <div className={`text-lg font-semibold ${dayPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmtUsd(dayPnl, 2)}
          </div>
          <div className="text-xs text-zinc-500">{todayClosed.length} закрыто сегодня</div>
        </div>
        <div className="card">
          <div className="stat-label">Источники данных</div>
          <div className={`text-lg font-semibold ${badSources.length ? "text-amber-400" : "text-emerald-400"}`}>
            {sources.length - badSources.length}/{sources.length || "0"} ok
          </div>
          {badSources.length > 0 && (
            <div className="text-xs text-red-400">{badSources.map((s) => s.source).join(", ")}</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Лучшие текущие возможности" right={<Link className="text-xs text-sky-400" href="/scanner">все →</Link>}>
          {topOpps.length === 0 ? (
            <Empty text="Пока нет возможностей — запусти worker: npm run worker" />
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>Токен</th><th>Статус</th><th>Score</th><th>Risk</th><th>Обновлено</th></tr>
              </thead>
              <tbody>
                {topOpps.map((o) => (
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
                    <td className="text-xs text-zinc-500">{timeAgo(o.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Активные позиции" right={<Link className="text-xs text-sky-400" href="/positions">все →</Link>}>
          {openPositions.length === 0 ? (
            <Empty text="Нет открытых позиций" />
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>Токен</th><th>Режим</th><th>Вход</th><th>Стоимость</th><th>Realized P&L</th></tr>
              </thead>
              <tbody>
                {openPositions.map((p) => (
                  <tr key={p.id}>
                    <td>{p.token.symbol}</td>
                    <td className="text-xs">{p.mode}</td>
                    <td className="text-xs">{p.entryPriceUsd.toPrecision(4)}</td>
                    <td>{fmtUsd(p.costUsd, 2)}</td>
                    <td className={p.realizedPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {fmtUsd(p.realizedPnlUsd, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Уведомления и предупреждения">
        {notifications.length === 0 ? (
          <Empty text="Уведомлений нет" />
        ) : (
          <ul className="space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-2">
                <span
                  className={
                    n.level === "critical" ? "text-red-400" : n.level === "warning" ? "text-amber-400" : "text-zinc-500"
                  }
                >
                  ●
                </span>
                <div>
                  <span className="font-medium">{n.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">{timeAgo(n.createdAt)}</span>
                  <div className="whitespace-pre-line text-xs text-zinc-400">{n.body}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function safeRegime(scoresJson: string): string | null {
  try {
    const s = JSON.parse(scoresJson);
    const v = s?.marketRegime?.inputs?.solChange24hPct;
    return typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : null;
  } catch {
    return null;
  }
}
