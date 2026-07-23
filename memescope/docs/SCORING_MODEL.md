# Scoring Model

Код: `src/lib/scoring/engine.ts` (единственный источник истины — документ описывает
его; при изменении кода обновляйте документ).

## Принципы

1. Никаких случайных чисел — одинаковый вход всегда даёт одинаковый выход (покрыто тестом).
2. Каждая компонента хранит формулу, входы и объяснение — они показываются в UI.
3. Отсутствующие данные не заменяются выдуманными: компонента отмечает «нет данных»,
   confidence падает.
4. **Веса и пороги — стартовые эвристики, не подтверждённые backtest'ом.** Их
   калибровка — задача исследовательского этапа (BACKTEST_METHODOLOGY).

## Примитивы

- `ramp(v, lo, hi)` — линейно 0→100 между lo и hi, с клампом.
- `tri(v, lo, peak, hi)` — 100 в peak, 0 на краях: «хорошо в меру» (рост есть, но
  вертикальный памп — уже поздно).

## Opportunity-компоненты (среднее по известным частям)

| Компонента | Вес | Части |
| --- | --- | --- |
| Momentum | 0.30 | volAccel: tri(0.5, 2.5, 8); buySellRatio1h: tri(0.8, 1.8, 5); Δ1ч: tri(−20, 25, 150); Δ24ч: tri(−50, 80, 500) |
| Liquidity | 0.20 | log10(liq): ramp(4, 5.7) — $10k→0, $500k→100; vol/liq: tri(0.2, 4, 30); sellImpact: 100−ramp(0.5, 8) |
| Holder Quality | 0.20 | log10(holders): ramp(2, 3.7); top10%: 100−ramp(15, 60); lpLocked%: ramp(0, 100) |
| Social/Narrative | 0.10 | MVP-заглушка: сайт/соцсети есть → 60, нет → 20 (полный модуль — ROADMAP) |
| Market Regime | 0.20 | SOL Δ24ч: tri(−12, 3, 25) — спокойный рост благоприятен, обвал и эйфория — нет |

`volAccel = (volume5m × 12) / volume1h` — >1 значит объём ускоряется.

## Risk-компоненты (0–100, выше = хуже)

| Компонента | Вес | Формула |
| --- | --- | --- |
| Contract Risk | 0.4 | 40×mintAuth + 40×freezeAuth + 0.25×(100−lpLocked%) + 7×dangerFlags, cap 100; rugged → 100 |
| Manipulation Risk | 0.3 | штрафы: vol/liq>20; |buy/sell−1|<0.08; top10>30%; Δ24ч>300% |
| Exit Liquidity Risk | 0.3 | 10×(позиция как % пула) + 5×sellImpact% + штраф FDV/liq>50; нет данных о liq → 80 |

## Итог

```
riskScore        = Σ(risk_i × w_i) / Σw_i
opportunityRaw   = Σ(opp_i × w_i) / Σw_i
MOS              = opportunityRaw × (1 − 0.6 × riskScore/100)
confidence       = max(0.1, 1 − 0.12 × |dataGaps|)   (cap штрафа 0.9)
```

## Пороги статусов (`strategy/lifecycle.ts`)

- READY: MOS ≥ 65 и confidence ≥ 0.6
- CANDIDATE: MOS ≥ 50
- WATCH: остальное (или токен старше окна стратегии)

## Hard rejection rules (`risk/engine.ts`) — блокируют READY/BUY при любом score

| Rule | Условие |
| --- | --- |
| rugged | источник риска пометил rug pull |
| sell-not-confirmed | Jupiter не строит маршрут продажи (honeypot-признак) |
| mint-authority / freeze-authority | полномочия не отозваны |
| critical-contract-risk | riskLevel=critical у провайдера |
| holder-concentration | top-10 > 60% supply |
| insider-concentration | инсайдеры > 30% |
| insufficient-liquidity | liq < minLiquidityUsd (настройка) |
| slippage-exceeds-limit | ожидаемый impact продажи > maxSlippagePct |
| too-new | возраст < minTokenAgeMin (окно снайперов/мгновенных ругов) |
| suspected-wash-trading | vol/liq > 50 при почти идеальной симметрии buy/sell |
| insufficient-data | нет цены/ликвидности/объёма или снапшота → DATA_UNAVAILABLE |
