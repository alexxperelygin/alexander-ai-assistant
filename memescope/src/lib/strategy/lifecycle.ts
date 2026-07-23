import type {
  FeatureVector,
  OpportunityStatus,
  RejectionHit,
  RiskSettings,
  ScoreBreakdown,
  TradePlan,
} from "../types";

// Signal lifecycle decision: maps (features, scores, rejections, settings) to
// a status plus human-readable reasons. Pure and deterministic.

export interface Decision {
  status: OpportunityStatus;
  reasons: string[];
}

export const READY_SCORE = 65;
export const CANDIDATE_SCORE = 50;
export const WATCH_SCORE = 35;
export const MIN_CONFIDENCE_FOR_READY = 0.6;

export function decideStatus(args: {
  features: FeatureVector;
  scores: ScoreBreakdown;
  rejections: RejectionHit[];
  settings: RiskSettings;
  previousStatus?: OpportunityStatus;
}): Decision {
  const { features: f, scores, rejections, settings } = args;
  const reasons: string[] = [];

  // Terminal user-driven states are handled by position monitoring, not here.
  const hardBlocked = rejections.filter((r) => r.rule !== "insufficient-data");
  const dataBlocked = rejections.some((r) => r.rule === "insufficient-data");

  if (dataBlocked && hardBlocked.length === 0) {
    return {
      status: "DATA_UNAVAILABLE",
      reasons: ["Ключевые данные отсутствуют или устарели — решение невозможно.",
        ...rejections.map((r) => r.description)],
    };
  }

  if (hardBlocked.length > 0) {
    return {
      status: "AVOID",
      reasons: hardBlocked.map((r) => `[${r.rule}] ${r.description}`),
    };
  }

  if (settings.signalsPaused) {
    return {
      status: "WATCH",
      reasons: ["Новые сигналы глобально приостановлены в Settings (kill switch)."],
    };
  }

  const s = scores.opportunityScore;
  reasons.push(
    `Opportunity Score ${s.toFixed(1)}/100, Risk ${scores.riskScore.toFixed(1)}/100, confidence ${(scores.confidence * 100).toFixed(0)}%.`,
  );

  if (f.tokenAgeMin != null && f.tokenAgeMin > settings.maxTokenAgeMin) {
    return {
      status: "WATCH",
      reasons: [...reasons, `Токен старше окна стратегии (${Math.round(f.tokenAgeMin / 60)}ч) — вне мандата "ранние монеты".`],
    };
  }

  if (s >= READY_SCORE && scores.confidence >= MIN_CONFIDENCE_FOR_READY) {
    reasons.push(
      `Score ≥ ${READY_SCORE} и confidence ≥ ${MIN_CONFIDENCE_FOR_READY * 100}% — сигнал готов; подтверждение покупки остаётся за пользователем.`,
    );
    return { status: "READY", reasons };
  }
  if (s >= CANDIDATE_SCORE) {
    reasons.push(`Score в диапазоне ${CANDIDATE_SCORE}–${READY_SCORE} — кандидат, ждём подтверждения momentum/данных.`);
    return { status: "CANDIDATE", reasons };
  }
  if (s >= WATCH_SCORE) {
    reasons.push(`Score в диапазоне ${WATCH_SCORE}–${CANDIDATE_SCORE} — наблюдение.`);
    return { status: "WATCH", reasons };
  }
  return { status: "WATCH", reasons: [...reasons, "Score ниже порога наблюдения — низкий приоритет."] };
}

// Position sizing from user capital and risk budget.
// size = min(maxPositionUsd, capital × maxRiskPerTradePct% / assumedStopLoss,
//            liquidity × maxPositionPctOfLiquidity%)
// assumedStopLoss: доля позиции, теряемая при срабатывании стопа (по умолчанию 50% —
// мем-коины гэпают, консервативно считаем половину позиции риском).
export const ASSUMED_STOP_LOSS_FRACTION = 0.5;

export function computePositionSizeUsd(settings: RiskSettings, liquidityUsd: number | null): number {
  const riskBudget = settings.capitalUsd * (settings.maxRiskPerTradePct / 100);
  const byRisk = riskBudget / ASSUMED_STOP_LOSS_FRACTION;
  const byLiquidity =
    liquidityUsd != null ? liquidityUsd * (settings.maxPositionPctOfLiquidity / 100) : settings.maxPositionUsd;
  return Math.max(0, Math.min(settings.maxPositionUsd, byRisk, byLiquidity));
}

export function buildTradePlan(args: {
  features: FeatureVector;
  settings: RiskSettings;
  symbol: string;
  mint: string;
  dex?: string | null;
  now?: Date;
}): TradePlan | null {
  const { features: f, settings, symbol, mint } = args;
  const now = args.now ?? new Date();
  if (f.priceUsd == null || f.liquidityUsd == null) return null;

  const positionSizeUsd = computePositionSizeUsd(settings, f.liquidityUsd);
  const price = f.priceUsd;
  const dexRoute = `Jupiter aggregator${args.dex ? ` (пул: ${args.dex})` : ""}`;

  return {
    entryLowUsd: price * 0.97,
    entryHighUsd: price * 1.05,
    maxSlippagePct: settings.maxSlippagePct,
    positionSizeUsd,
    maxPositionPctOfLiquidity: settings.maxPositionPctOfLiquidity,
    dexRoute,
    buyInstruction: [
      `1. Открой jup.ag, подключи кошелёк (НИКОГДА не вводи seed-фразу на сторонних сайтах).`,
      `2. Вставь mint-адрес токена: ${mint} (проверь тикер ${symbol} и совпадение адреса — по адресу, не по названию).`,
      `3. Укажи сумму ~$${positionSizeUsd.toFixed(0)} в SOL, выставь slippage ≤ ${settings.maxSlippagePct}%.`,
      `4. Проверь price impact в котировке: если > ${settings.maxSlippagePct}% — не покупай.`,
      `5. Если цена вне диапазона $${fmtPrice(price * 0.97)}–$${fmtPrice(price * 1.05)} — вход отменён.`,
      `6. После покупки нажми "I bought" на карточке сигнала и введи фактическую цену/размер.`,
    ].join("\n"),
    invalidation: [
      `Цена выше $${fmtPrice(price * 1.05)} до входа (погоня за пампом запрещена).`,
      `Ликвидность упала ниже $${Math.round(f.liquidityUsd * 0.7).toLocaleString()} (−30%).`,
      `Появился любой hard-rejection риск (mint/freeze authority, sell route, концентрация).`,
      `Сигналу больше 30 минут без обновления данных.`,
    ],
    stopCondition: `Цена −35% от входа ИЛИ ликвидность −40% от уровня на входе ИЛИ sell-маршрут перестал подтверждаться → немедленный полный выход.`,
    takeProfitLevels: [
      { multiple: 1.5, sellFraction: 0.33 },
      { multiple: 2.0, sellFraction: 0.33 },
      { multiple: 4.0, sellFraction: 0.34 },
    ],
    fullExitCondition:
      "Полный выход: сработал stop, или исполнены все TP-уровни, или статус стал INVALIDATED/EXIT (напр. крупные держатели выходят, объём умирает).",
    validUntil: new Date(now.getTime() + 30 * 60 * 1000),
  };
}

function fmtPrice(v: number): string {
  return v < 0.001 ? v.toExponential(3) : v.toFixed(6);
}
