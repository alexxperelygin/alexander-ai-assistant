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

  // Портфель ведёт два РАЗНЫХ правила входа, и общая сумма P&L их складывает.
  // По ней невозможно понять, работает ли проверенное правило: его результат
  // тонет в убытке конвейера READY, про который уже известно, что он NO EDGE.
  // Поэтому итог показывается ещё и раздельно (docs/PREREGISTRATION.md).
  const TRACKS = [
    { rule: "validated-liquidity", title: "Проверенное правило (ликвидность > $50k)" },
    { rule: "low-liquidity-lottery", title: "Низкая ликвидность $10k–$50k (лотерейный трек)" },
    { rule: "ready-pipeline", title: "Конвейер READY (backtest: NO EDGE)" },
  ] as const;
  const tracks = TRACKS.map((t) => {
    const mine = positions.filter((p) => (p.entryRule ?? "ready-pipeline") === t.rule);
    const done = mine.filter((p) => p.status !== "OPEN" && p.status !== "PARTIAL_EXIT");
    return {
      ...t,
      open: mine.length - done.length,
      closed: done.length,
      pnl: done.reduce((s, p) => s + p.realizedPnlUsd, 0),
      wins: done.filter((p) => p.realizedPnlUsd > 0).length,
    };
  }).filter((t) => t.open + t.closed > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--txt)" }}>Кровоток</h1>
        <p className="text-[11px]" style={{ color: "var(--txt-dim)" }}>открытые и закрытые позиции, бумажные деньги</p>
      </div>
        <div className="text-sm">
          Итог по всем ветвям:{" "}
          <b className={totalRealized >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtUsd(totalRealized, 2)}</b>
        </div>
      </div>

      {tracks.length > 1 && (
        <Card title="По правилам входа">
          <table className="table-base">
            <thead>
              <tr><th>Правило</th><th>Открыто</th><th>Закрыто</th><th>Прибыльных</th><th>Realized</th></tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <tr key={t.rule}>
                  <td className="text-xs">{t.title}</td>
                  <td>{t.open}</td>
                  <td>{t.closed}</td>
                  <td>{t.closed ? `${t.wins} из ${t.closed}` : "—"}</td>
                  {/* Без закрытых сделок «$0» зелёным читается как «вышли в
                      ноль» — это не результат, а его отсутствие. */}
                  <td className={t.closed === 0 ? "glow-idle" : t.pnl >= 0 ? "glow-good" : "glow-bad"}>
                    {t.closed === 0 ? "нет закрытых" : fmtUsd(t.pnl, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-400">
            Это разные правила входа, а не портфели одной стратегии. Складывать их P&L
            бессмысленно. До 100 закрытых сделок по проверенному правилу и до 300 по
            лотерейному их проценты читать как результат нельзя: на распределении с толстым
            хвостом одна сделка двигает среднее на сотни процентов.
          </p>
        </Card>
      )}

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
