import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, DataModeBadge, Empty, StatusBadge, timeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const events = await prisma.signalEvent.findMany({
    include: { opportunity: { include: { token: { include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Signal History</h1>
      <p className="text-xs text-zinc-500">
        Все переходы статусов с причинами. "Результат после" — изменение цены с момента сигнала до
        последнего наблюдения (грубая метрика качества; строгие метрики считает Backtests).
      </p>
      <Card title={`События (${events.length})`}>
        {events.length === 0 ? (
          <Empty text="Сигналов ещё нет" />
        ) : (
          <table className="table-base">
            <thead>
              <tr><th>Время</th><th>Токен</th><th>Переход</th><th>Причина</th><th>Результат после</th></tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const payload = safeParse(e.payload);
                const sigPrice: number | null = payload?.plan?.entryHighUsd
                  ? (payload.plan.entryHighUsd + payload.plan.entryLowUsd) / 2
                  : null;
                const nowPrice = e.opportunity.token.snapshots[0]?.priceUsd ?? null;
                const outcome =
                  sigPrice && nowPrice ? ((nowPrice - sigPrice) / sigPrice) * 100 : null;
                return (
                  <tr key={e.id}>
                    <td className="text-xs text-zinc-500">{timeAgo(e.createdAt)} назад</td>
                    <td>
                      <Link href={`/opportunity/${e.opportunityId}`} className="text-sky-400 hover:underline">
                        {e.opportunity.token.symbol}
                      </Link>{" "}
                      <DataModeBadge mode={e.opportunity.dataMode} />
                    </td>
                    <td>
                      <span className="flex items-center gap-1">
                        {e.fromStatus && <><StatusBadge status={e.fromStatus} />→</>}
                        <StatusBadge status={e.toStatus} />
                      </span>
                    </td>
                    <td className="max-w-lg text-xs text-zinc-400">{e.reason}</td>
                    <td className={outcome == null ? "text-zinc-600" : outcome >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {outcome == null ? "—" : `${outcome >= 0 ? "+" : ""}${outcome.toFixed(1)}%`}
                    </td>
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

function safeParse(s: string | null): { plan?: { entryLowUsd: number; entryHighUsd: number } } | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
