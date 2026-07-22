import { prisma } from "@/lib/db";
import { Card, Empty, StatusBadge, fmtPrice, fmtUsd, timeAgo } from "@/components/ui";
import { PositionActions } from "@/components/PositionActions";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const positions = await prisma.position.findMany({
    include: {
      token: { include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } },
      events: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { openedAt: "desc" },
    take: 50,
  });

  const open = positions.filter((p) => p.status === "OPEN" || p.status === "PARTIAL_EXIT");
  const closed = positions.filter((p) => p.status !== "OPEN" && p.status !== "PARTIAL_EXIT");
  const totalRealized = positions.reduce((s, p) => s + p.realizedPnlUsd, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Positions</h1>
        <div className="text-sm">
          Realized P&L всего:{" "}
          <b className={totalRealized >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtUsd(totalRealized, 2)}</b>
        </div>
      </div>

      <Card title={`Открытые (${open.length})`}>
        {open.length === 0 ? (
          <Empty text="Нет открытых позиций" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Токен</th><th>Режим</th><th>Статус</th><th>Вход</th><th>Тек. цена</th>
                <th>Unrealized</th><th>Realized</th><th>TP уровни</th><th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {open.map((p) => {
                const cur = p.token.snapshots[0]?.priceUsd ?? null;
                const unreal = cur != null ? (cur - p.entryPriceUsd) * p.remainingQty : null;
                const tps: { price: number; done: boolean }[] = p.takeProfits ? JSON.parse(p.takeProfits) : [];
                return (
                  <tr key={p.id}>
                    <td>{p.token.symbol}</td>
                    <td className="text-xs">{p.mode}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="text-xs">{fmtPrice(p.entryPriceUsd)}</td>
                    <td className="text-xs">{fmtPrice(cur)}</td>
                    <td className={unreal == null ? "" : unreal >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {fmtUsd(unreal, 2)}
                    </td>
                    <td className={p.realizedPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {fmtUsd(p.realizedPnlUsd, 2)}
                    </td>
                    <td className="text-xs text-zinc-400">
                      {tps.map((tp, i) => (
                        <span key={i} className={tp.done ? "text-emerald-500 line-through" : ""}>
                          {fmtPrice(tp.price)}{i < tps.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </td>
                    <td><PositionActions positionId={p.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={`Закрытые (${closed.length})`}>
        {closed.length === 0 ? (
          <Empty text="Пока нет закрытых позиций" />
        ) : (
          <table className="table-base">
            <thead>
              <tr><th>Токен</th><th>Режим</th><th>Статус</th><th>P&L</th><th>Причина</th><th>Закрыта</th></tr>
            </thead>
            <tbody>
              {closed.map((p) => (
                <tr key={p.id}>
                  <td>{p.token.symbol}</td>
                  <td className="text-xs">{p.mode}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className={p.realizedPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {fmtUsd(p.realizedPnlUsd, 2)}
                  </td>
                  <td className="max-w-md text-xs text-zinc-400">{p.closeReason ?? "—"}</td>
                  <td className="text-xs text-zinc-500">{p.closedAt ? `${timeAgo(p.closedAt)} назад` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Журнал изменений (последние события)">
        <ul className="space-y-1 text-xs text-zinc-400">
          {positions.flatMap((p) =>
            p.events.map((e) => (
              <li key={e.id}>
                <span className="text-zinc-500">{timeAgo(e.createdAt)} назад</span>{" "}
                <b>{p.token.symbol}</b> [{e.kind}] {e.message}
              </li>
            )),
          ).slice(0, 30)}
        </ul>
      </Card>
    </div>
  );
}
