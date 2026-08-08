// Realistic paper-fill simulation. A paper order never fills at the ideal
// price: we model DEX fee, Solana network+priority fee, and price impact
// estimated from the constant-product approximation against observed pool
// liquidity. Impact ≈ tradeSize / (poolLiquidity/2 + tradeSize) for the
// одностороннюю глубину пула (half of TVL is the quote side).

export interface FillParams {
  sideUsd: number; // trade size in USD
  priceUsd: number; // mid price at decision time
  liquidityUsd: number | null; // pool TVL
  direction: "buy" | "sell";
  dexFeePct?: number; // default 0.25% (Raydium-style)
  networkFeeUsd?: number; // default $0.05 (base + priority fee estimate)
  latencyDriftPct?: number; // adverse price drift while tx lands; default 0.3%
  observedImpactPct?: number | null; // if a real aggregator quote provided impact, prefer it
}

export interface FillResult {
  executed: boolean;
  reason?: string;
  effectivePriceUsd: number;
  quantity: number; // token units bought/sold
  grossUsd: number;
  feesUsd: number;
  impactPct: number;
  totalCostPct: number; // full round-trip friction of THIS fill vs mid
}

/**
 * Проскальзывание, выше которого сделка считается неисполнимой.
 *
 * Формула impact = size/(depth+size) стремится к 100%, но задолго до этого
 * сделка перестаёт существовать в реальности: вылить в пул объём, сравнимый с
 * самим пулом, нельзя ни по какой цене. Без этого предела симуляция выдавала
 * «исполнение» с эффективной ценой около нуля — и такой выход выглядел не как
 * невозможный, а как чудовищный убыток.
 */
const MAX_EXECUTABLE_IMPACT_PCT = 50;

export function simulateFill(p: FillParams): FillResult {
  const dexFeePct = p.dexFeePct ?? 0.25;
  const networkFeeUsd = p.networkFeeUsd ?? 0.05;
  const latencyDriftPct = p.latencyDriftPct ?? 0.3;

  if (p.priceUsd <= 0 || p.sideUsd <= 0) {
    return {
      executed: false, reason: "invalid price/size", effectivePriceUsd: 0,
      quantity: 0, grossUsd: 0, feesUsd: 0, impactPct: 0, totalCostPct: 0,
    };
  }

  let impactPct: number;
  if (p.observedImpactPct != null) {
    impactPct = p.observedImpactPct;
  } else if (p.liquidityUsd != null && p.liquidityUsd > 0) {
    const depth = p.liquidityUsd / 2;
    impactPct = (p.sideUsd / (depth + p.sideUsd)) * 100;
  } else {
    // Unknown liquidity: refuse to pretend execution quality is knowable.
    return {
      executed: false, reason: "liquidity unknown — fill not simulatable",
      effectivePriceUsd: 0, quantity: 0, grossUsd: 0, feesUsd: 0, impactPct: 0, totalCostPct: 0,
    };
  }

  if (impactPct >= MAX_EXECUTABLE_IMPACT_PCT) {
    return {
      executed: false,
      reason: `проскальзывание ${impactPct.toFixed(0)}% — объём несопоставим с пулом, сделка неисполнима`,
      effectivePriceUsd: 0, quantity: 0, grossUsd: 0, feesUsd: 0, impactPct, totalCostPct: 0,
    };
  }

  // Ограничение снизу на эффективную цену: без него adversePct > 100 давал
  // ОТРИЦАТЕЛЬНУЮ цену исполнения, то есть продавец доплачивал покупателю.
  const adversePct = Math.min(99, impactPct + latencyDriftPct);
  const effectivePriceUsd =
    p.direction === "buy"
      ? p.priceUsd * (1 + adversePct / 100)
      : p.priceUsd * (1 - adversePct / 100);

  const quantity = p.direction === "buy" ? 0 : p.sideUsd / p.priceUsd;
  // Комиссия DEX берётся с ФАКТИЧЕСКОГО оборота сделки, а не с суммы, которую
  // хотелось получить. На продаже это принципиально: если цена в данных
  // скакнула, желаемая сумма огромна, а реально исполнить удаётся копейки —
  // комиссия, посчитанная от желаемой, превращала сделку в убыток в тысячи
  // процентов. Лонг не может потерять больше вложенного.
  const sellGrossUsd = p.direction === "sell" ? quantity * effectivePriceUsd : 0;
  const turnoverUsd = p.direction === "buy" ? p.sideUsd : sellGrossUsd;
  const dexFeeUsd = turnoverUsd * (dexFeePct / 100);
  const feesUsd = dexFeeUsd + networkFeeUsd;

  const netUsd = p.sideUsd - (p.direction === "buy" ? feesUsd : 0);
  const buyQuantity = netUsd / effectivePriceUsd;
  const grossUsd =
    p.direction === "buy" ? netUsd : Math.max(0, sellGrossUsd - feesUsd);

  return {
    executed: true,
    effectivePriceUsd,
    quantity: p.direction === "buy" ? buyQuantity : quantity,
    grossUsd,
    feesUsd,
    impactPct,
    totalCostPct: adversePct + dexFeePct + (networkFeeUsd / p.sideUsd) * 100,
  };
}
