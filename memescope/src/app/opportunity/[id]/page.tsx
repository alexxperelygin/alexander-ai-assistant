import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, DataModeBadge, ScoreBar, StatusBadge, fmtPct, fmtPrice, fmtUsd, timeAgo } from "@/components/ui";
import { BuyActions } from "@/components/BuyActions";
import type { RejectionHit, RiskFlag, ScoreBreakdown, ScoreComponent, TradePlan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      token: { include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 20 } } },
      signals: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!opp) notFound();

  const scores = parse<ScoreBreakdown>(opp.scores);
  const reasons = parse<string[]>(opp.reasons) ?? [];
  const risks = parse<RiskFlag[]>(opp.risks) ?? [];
  const rejections = parse<RejectionHit[]>(opp.rejections) ?? [];
  const plan = parse<TradePlan>(opp.plan);
  const features = parse<Record<string, unknown>>(opp.featuresRef);
  const latest = opp.token.snapshots[0];
  const canOpen =
    (opp.status === "READY" || opp.status === "CANDIDATE") && rejections.length === 0 && plan != null;

  const components: ScoreComponent[] = scores
    ? [scores.momentum, scores.liquidity, scores.holderQuality, scores.socialNarrative,
       scores.marketRegime, scores.contractRisk, scores.manipulationRisk, scores.exitLiquidityRisk]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">{opp.token.symbol}</h1>
        <StatusBadge status={opp.status} />
        <DataModeBadge mode={opp.dataMode} />
        <span className="text-xs text-zinc-500">обновлено {timeAgo(opp.updatedAt)} назад</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Цена" value={fmtPrice(latest?.priceUsd)} />
        <Stat label="Market cap" value={fmtUsd(latest?.marketCapUsd)} />
        <Stat label="Ликвидность" value={fmtUsd(latest?.liquidityUsd)} />
        <Stat label="Объём 24ч" value={fmtUsd(latest?.volume24hUsd)} />
        <Stat label="Свежесть данных" value={latest ? `${timeAgo(latest.fetchedAt)} назад` : "нет данных"} />
      </div>

      <Card title="Контракт">
        <div className="space-y-1 font-mono text-xs text-zinc-400">
          <div>mint: <span className="select-all text-zinc-200">{opp.token.mint}</span></div>
          {opp.token.pairAddress && <div>pair: <span className="select-all">{opp.token.pairAddress}</span> ({opp.token.dex})</div>}
          <div className="flex gap-3 pt-1 font-sans">
            <a className="text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://dexscreener.com/solana/${opp.token.pairAddress ?? opp.token.mint}`}>DexScreener ↗</a>
            <a className="text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://rugcheck.xyz/tokens/${opp.token.mint}`}>RugCheck ↗</a>
            <a className="text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://jup.ag/swap/SOL-${opp.token.mint}`}>Jupiter ↗</a>
            <a className="text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://solscan.io/token/${opp.token.mint}`}>Solscan ↗</a>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Оценка: ${opp.opportunityScore.toFixed(1)}/100 · Risk ${opp.riskScore.toFixed(1)} · confidence ${(opp.confidence * 100).toFixed(0)}%`}>
          <div className="space-y-3">
            {components.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{c.name}</span>
                  <ScoreBar value={c.score} danger={c.name.includes("Risk")} />
                </div>
                <p className="text-xs leading-snug text-zinc-500">{c.explanation}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Причины сигнала">
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
              {reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>
          {rejections.length > 0 && (
            <Card title="Hard rejections (BUY заблокирован)">
              <ul className="space-y-1 text-sm text-red-400">
                {rejections.map((r, i) => <li key={i}>[{r.rule}] {r.description}</li>)}
              </ul>
            </Card>
          )}
          <Card title="Обнаруженные риски">
            {risks.length === 0 ? (
              <p className="text-sm text-zinc-500">Риск-провайдер не вернул флагов (это не гарантия безопасности).</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {risks.map((r, i) => (
                  <li key={i} className={r.severity === "critical" || r.severity === "danger" ? "text-red-400" : r.severity === "warning" ? "text-amber-400" : "text-zinc-400"}>
                    [{r.severity}] {r.name}{r.description ? ` — ${r.description}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {plan && (
        <Card title="Торговый план" right={<span className="text-xs text-zinc-500">действует до {plan.validUntil ? new Date(plan.validUntil).toLocaleTimeString() : "—"}</span>}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <div>Вход: <b>{fmtPrice(plan.entryLowUsd)} – {fmtPrice(plan.entryHighUsd)}</b></div>
              <div>Размер позиции: <b>{fmtUsd(plan.positionSizeUsd, 0)}</b> (≤{plan.maxPositionPctOfLiquidity}% ликвидности пула)</div>
              <div>Slippage: <b>≤{plan.maxSlippagePct}%</b></div>
              <div>Маршрут: {plan.dexRoute}</div>
              <div>Stop: {plan.stopCondition}</div>
              <div>
                Фиксация прибыли:{" "}
                {plan.takeProfitLevels.map((tp) => `${tp.multiple}x → продать ${Math.round(tp.sellFraction * 100)}%`).join("; ")}
              </div>
              <div>Полный выход: {plan.fullExitCondition}</div>
              <div className="pt-1">
                <div className="stat-label">Отмена входа (invalidation)</div>
                <ul className="list-inside list-disc text-xs text-zinc-400">
                  {plan.invalidation.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            </div>
            <div>
              <div className="stat-label mb-1">Инструкция покупки</div>
              <pre className="whitespace-pre-wrap rounded-lg border p-3 text-xs leading-relaxed" style={{ borderColor: "var(--line)", background: "rgba(2,4,10,0.7)", color: "var(--txt)" }}>{plan.buyInstruction}</pre>
            </div>
          </div>
          <div className="mt-4">
            <BuyActions opportunityId={opp.id} suggestedSizeUsd={plan.positionSizeUsd} canOpen={canOpen} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Последние наблюдения (mini-chart)">
          <Sparkline snapshots={opp.token.snapshots.slice().reverse()} />
          <table className="table-base mt-2">
            <thead><tr><th>Время</th><th>Цена</th><th>Ликвидность</th><th>Δ1ч</th><th>Источник</th></tr></thead>
            <tbody>
              {opp.token.snapshots.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td className="text-xs">{timeAgo(s.fetchedAt)} назад</td>
                  <td className="text-xs">{fmtPrice(s.priceUsd)}</td>
                  <td className="text-xs">{fmtUsd(s.liquidityUsd)}</td>
                  <td className="text-xs">{fmtPct(s.priceChange1h)}</td>
                  <td className="text-xs text-zinc-500">{s.source} <DataModeBadge mode={s.dataMode} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="История статусов">
          <ul className="space-y-2 text-sm">
            {opp.signals.map((s) => (
              <li key={s.id}>
                <div className="flex items-center gap-2">
                  {s.fromStatus && <><StatusBadge status={s.fromStatus} /><span className="text-zinc-600">→</span></>}
                  <StatusBadge status={s.toStatus} />
                  <span className="text-xs text-zinc-500">{timeAgo(s.createdAt)} назад</span>
                </div>
                <p className="text-xs text-zinc-500">{s.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {Array.isArray(features?.dataGaps) && features.dataGaps.length > 0 && (
        <p className="text-xs text-amber-500">
          Пропуски данных при расчёте: {(features.dataGaps as string[]).join(", ")} — confidence снижен.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function Sparkline({ snapshots }: { snapshots: { priceUsd: number | null; id: string }[] }) {
  const prices = snapshots.map((s) => s.priceUsd).filter((p): p is number => p != null);
  if (prices.length < 2) return <p className="text-xs text-zinc-600">Недостаточно точек для графика.</p>;
  const min = Math.min(...prices), max = Math.max(...prices);
  const w = 400, h = 60;
  const pts = prices
    .map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / (max - min || 1)) * (h - 6) - 3}`)
    .join(" ");
  const up = (prices[prices.length - 1] ?? 0) >= (prices[0] ?? 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
      <polyline points={pts} fill="none" stroke={up ? "#34d399" : "#f87171"} strokeWidth="1.5" />
    </svg>
  );
}

function parse<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}
