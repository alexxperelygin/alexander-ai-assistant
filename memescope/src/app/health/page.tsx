import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { Card, DataModeBadge, Empty, timeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const [sources, lastScan, lastMonitorErr, recentErrors, latestSnapshot] = await Promise.all([
    prisma.sourceHealth.findMany({ orderBy: { source: "asc" } }),
    prisma.auditLog.findFirst({ where: { action: "scan.cycle" }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findFirst({ where: { action: { contains: "error" } }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { action: { contains: "error" } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.tokenSnapshot.findFirst({ orderBy: { fetchedAt: "desc" } }),
  ]);

  const scanAge = lastScan ? Date.now() - lastScan.createdAt.getTime() : null;
  const workerOk = scanAge != null && scanAge < config.scanIntervalSec * 3000;
  const dataFresh = latestSnapshot
    ? Date.now() - latestSnapshot.fetchedAt.getTime() < 5 * 60_000
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--txt)" }}>Диагностика</h1>
        <p className="text-[11px]" style={{ color: "var(--txt-dim)" }}>здоровье источников данных и процессов</p>
      </div>
        <DataModeBadge mode={config.dataMode} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <HealthStat label="Worker / scheduler" ok={workerOk}
          detail={lastScan ? `последний цикл ${timeAgo(lastScan.createdAt)} назад` : "не запускался"} />
        <HealthStat label="Свежесть данных" ok={dataFresh}
          detail={latestSnapshot ? `последний снапшот ${timeAgo(latestSnapshot.fetchedAt)} назад` : "снапшотов нет"} />
        <HealthStat label="Источники" ok={sources.every((s) => !s.lastErrorAt || (s.lastOkAt != null && s.lastOkAt > s.lastErrorAt))}
          detail={`${sources.length} отслеживается`} />
        <HealthStat label="Последняя ошибка" ok={lastMonitorErr == null}
          detail={lastMonitorErr ? `${timeAgo(lastMonitorErr.createdAt)} назад` : "нет"} />
      </div>

      <Card title="Источники данных: задержка и ошибки">
        {sources.length === 0 ? <Empty text="Worker ещё не обращался к источникам" /> : (
          <table className="table-base">
            <thead>
              <tr><th>Источник</th><th>Статус</th><th>Latency</th><th>OK</th><th>Ошибок</th><th>Последний успех</th><th>Последняя ошибка</th></tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const ok = s.lastOkAt && (!s.lastErrorAt || s.lastOkAt > s.lastErrorAt);
                return (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td>{ok ? <span className="text-emerald-400">ok</span> : <span className="text-red-400">degraded</span>}</td>
                    <td className="text-xs">{s.latencyMs != null ? `${s.latencyMs}мс` : "—"}</td>
                    <td className="text-xs">{s.okCount}</td>
                    <td className="text-xs">{s.errorCount}</td>
                    <td className="text-xs text-zinc-500">{s.lastOkAt ? `${timeAgo(s.lastOkAt)} назад` : "—"}</td>
                    <td className="max-w-sm truncate text-xs text-red-400/80" title={s.lastError ?? ""}>
                      {s.lastError ? `${timeAgo(s.lastErrorAt)} назад: ${s.lastError}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Последние ошибки (audit log)">
        {recentErrors.length === 0 ? <Empty text="Ошибок не зарегистрировано" /> : (
          <ul className="space-y-1 text-xs text-zinc-400">
            {recentErrors.map((e) => (
              <li key={e.id}>
                <span className="text-zinc-500">{timeAgo(e.createdAt)} назад</span> [{e.action}]{" "}
                <span className="text-red-400/80">{e.details?.slice(0, 200)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HealthStat({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`text-lg font-semibold ${ok ? "text-emerald-400" : "text-red-400"}`}>
        {ok ? "OK" : "ПРОБЛЕМА"}
      </div>
      <div className="text-xs text-zinc-500">{detail}</div>
    </div>
  );
}
