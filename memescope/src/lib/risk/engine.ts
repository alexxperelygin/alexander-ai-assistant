import type { ContractRiskReport, FeatureVector, RejectionHit, RiskSettings } from "../types";
import { chainConfig, DEFAULT_CHAIN } from "../chains";

// Hard rejection rules. Any hit forbids BUY/READY regardless of score.
// Rules are pure functions of (features, risk report, settings) so every
// decision is reproducible from stored inputs.

/** Порог оттока ликвидности между соседними наблюдениями, при котором вход запрещён. */
export const LIQ_DRAIN_REJECT_PCT = -5;

export function evaluateHardRejections(
  f: FeatureVector,
  risk: ContractRiskReport | null,
  settings: RiskSettings,
  ctx: { chain?: string } = {},
): RejectionHit[] {
  const hits: RejectionHit[] = [];
  const add = (rule: string, description: string) => hits.push({ rule, description });

  // Сеть без источника контрактных рисков даёт данные для исследования, но не
  // может выдать торговый сигнал. Купить токен, у которого не проверены ни
  // права на эмиссию, ни возможность продать, — это ровно тот риск, ради
  // снятия которого система и писалась. Снимается добавлением risk-провайдера
  // для сети (см. chains.ts), а не ослаблением правила.
  const chain = ctx.chain ?? DEFAULT_CHAIN;
  const cfg = chainConfig(chain);
  if (!cfg)
    add("unknown-chain", `Сеть "${chain}" не входит в реестр поддерживаемых.`);
  else if (!cfg.hasRiskProvider)
    add(
      "no-contract-risk-source",
      `Для сети ${cfg.label} нет источника проверки контракта (эмиссия, заморозка, honeypot). Данные собираются для исследования, торговый сигнал не выдаётся.`,
    );
  // Без агрегатора нельзя симулировать продажу, поэтому единственное
  // доказательство выхода — прямой ответ проверки контракта. Молчание
  // источника доказательством не является.
  else if (!cfg.hasRouteProvider && f.sellRouteOk !== true)
    add(
      "sell-not-verified",
      `В сети ${cfg.label} продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверждения выхода вход запрещён.`,
    );

  if (f.rugged === true) add("rugged", "Источник риска пометил токен как rug pull.");

  if (f.sellRouteOk === false)
    add("sell-not-confirmed", "Продажа не подтверждается симуляцией маршрута (возможен honeypot).");

  if (f.mintAuthorityActive === true)
    add("mint-authority", "Mint authority не отозвана — возможна дополнительная эмиссия.");

  if (f.freezeAuthorityActive === true)
    add("freeze-authority", "Freeze authority не отозвана — продажи могут быть заблокированы.");

  if (risk?.riskLevel === "critical")
    add("critical-contract-risk", "Критический уровень риска контракта по данным risk-провайдера.");

  if (f.top10Pct != null && f.top10Pct > 60)
    add(
      "holder-concentration",
      `Top-10 держателей контролируют ${f.top10Pct.toFixed(1)}% предложения (порог 60%).`,
    );

  if (risk?.insiderPct != null && risk.insiderPct > 30)
    add("insider-concentration", `Связанные/инсайдерские кошельки держат ${risk.insiderPct.toFixed(1)}% (порог 30%).`);

  if (f.liquidityUsd != null && f.liquidityUsd < settings.minLiquidityUsd)
    add(
      "insufficient-liquidity",
      `Ликвидность $${Math.round(f.liquidityUsd).toLocaleString()} ниже минимума $${settings.minLiquidityUsd.toLocaleString()}.`,
    );

  // Уходящая ликвидность — единственный предвестник ругпулла, видимый ДО входа.
  // На чистых данных 6 августа наблюдения с падением ликвидности >5% между
  // соседними опросами дали медиану −92.5% и лишь 7% прибыльных (n=127), и
  // эффект сохранился на train и на test. Правило отбраковочное: оно ничего не
  // обещает, оно убирает категорию, которая почти всегда теряет почти всё.
  if (f.liqTrendPct != null && f.liqTrendPct < LIQ_DRAIN_REJECT_PCT)
    add(
      "liquidity-draining",
      `Ликвидность упала на ${Math.abs(f.liqTrendPct).toFixed(1)}% с прошлого наблюдения (порог ${Math.abs(LIQ_DRAIN_REJECT_PCT)}%) — из пула выводят средства.`,
    );

  if (f.sellImpactPct != null && f.sellImpactPct > settings.maxSlippagePct)
    add(
      "slippage-exceeds-limit",
      `Ожидаемый price impact продажи ${f.sellImpactPct.toFixed(1)}% выше лимита ${settings.maxSlippagePct}%.`,
    );

  if (f.tokenAgeMin != null && f.tokenAgeMin < settings.minTokenAgeMin)
    add(
      "too-new",
      `Токену ${Math.round(f.tokenAgeMin)} мин — младше минимального возраста ${settings.minTokenAgeMin} мин (окно максимального риска снайперов/rug).`,
    );

  // Wash-trading heuristic: 24h volume implausibly large vs liquidity together
  // with extreme buy/sell symmetry is a manipulation signature.
  if (
    f.volToLiq != null && f.volToLiq > 50 &&
    f.buySellRatio1h != null && f.buySellRatio1h > 0.9 && f.buySellRatio1h < 1.1
  )
    add("suspected-wash-trading", "Аномальный объём относительно ликвидности при почти идеальной симметрии покупок/продаж.");

  // Data sufficiency: core fields must exist for a BUY-grade decision.
  const critical: (keyof FeatureVector)[] = ["priceUsd", "liquidityUsd", "volume24hUsd"];
  const missing = critical.filter((k) => f[k] == null);
  if (missing.length > 0 || f.dataGaps.includes("market-snapshot"))
    add("insufficient-data", `Недостаточно данных для решения: ${[...missing, ...f.dataGaps].join(", ")}.`);

  return hits;
}

// Continuous risk scores 0..100 (higher = worse) used in the score breakdown.
export function contractRiskScore(f: FeatureVector, risk: ContractRiskReport | null): number {
  let score = 0;
  if (f.mintAuthorityActive) score += 40;
  if (f.freezeAuthorityActive) score += 40;
  if (f.rugged) score = 100;
  if (f.lpLockedPct != null) score += Math.max(0, (100 - f.lpLockedPct) * 0.25);
  else score += 10; // unknown LP lock status is itself a risk
  const dangerFlags = risk?.flags.filter((x) => x.severity === "danger" || x.severity === "critical").length ?? 0;
  score += Math.min(20, dangerFlags * 7);
  return Math.min(100, score);
}

export function manipulationRiskScore(f: FeatureVector): number {
  let score = 0;
  if (f.volToLiq != null && f.volToLiq > 20) score += Math.min(40, (f.volToLiq - 20) * 2);
  if (f.buySellRatio1h != null && Math.abs(f.buySellRatio1h - 1) < 0.08) score += 20;
  if (f.top10Pct != null) score += Math.min(30, Math.max(0, f.top10Pct - 30));
  if (f.priceChange24h != null && f.priceChange24h > 300) score += 20; // vertical chart
  return Math.min(100, score);
}

export function exitLiquidityRiskScore(f: FeatureVector, positionUsd: number): number {
  let score = 0;
  if (f.liquidityUsd == null) return 80;
  const posPct = (positionUsd / f.liquidityUsd) * 100;
  score += Math.min(50, posPct * 10); // >5% of pool = max penalty
  if (f.sellImpactPct != null) score += Math.min(30, f.sellImpactPct * 5);
  if (f.fdvToLiq != null && f.fdvToLiq > 50) score += Math.min(20, (f.fdvToLiq - 50) / 5);
  return Math.min(100, score);
}
