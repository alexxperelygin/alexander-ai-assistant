# Risk Model

Код: `src/lib/risk/engine.ts`, `src/lib/strategy/lifecycle.ts`,
`src/lib/paper/portfolio.ts`. Все параметры редактируются на странице Settings.

> Лимиты снижают риск, но **не гарантируют** защиту от потерь. Мем-коины могут
> обесцениться полностью и мгновенно, включая сценарии, которые ни один фильтр
> не ловит заранее.

## Position sizing

```
riskBudget   = capitalUsd × maxRiskPerTradePct%          (по умолчанию 1000 × 1% = $10)
byRisk       = riskBudget / 0.5                          (консервативно: стоп мем-коина ≈ −50%)
byLiquidity  = liquidityUsd × maxPositionPctOfLiquidity% (по умолчанию 1% пула)
size         = min(maxPositionUsd, byRisk, byLiquidity)
```

## Лимиты по умолчанию (консервативные)

| Параметр | Значение | Назначение |
| --- | --- | --- |
| liveTradingEnabled | **false, жёстко** | этап 1: автоисполнение реальных сделок отключено на уровне кода (`settings.ts` перезаписывает любое сохранённое значение) |
| paperTradingEnabled | true | paper-режим включён |
| maxPositionUsd | $50 | лимит одной позиции |
| maxTotalExposureUsd | $200 | лимит суммарной экспозиции |
| dailyLossLimitUsd | $50 | при достижении новые сделки блокируются до конца дня |
| cooldownAfterLosses / cooldownMinutes | 3 / 120 | пауза после серии убытков |
| maxSlippagePct | 3% | и для плана, и для hard rejection |
| maxPositionPctOfLiquidity | 1% | позиция не больше 1% пула |
| minLiquidityUsd | $10 000 | ниже — AVOID |
| minTokenAgeMin / maxTokenAgeMin | 20 мин / 7 дней | окно стратегии |
| signalsPaused | false | **глобальный kill switch** новых сигналов |

## Запреты, зашитые в код (не настройки)

- усреднение падающей позиции и martingale — механизма докупки не существует;
  повторное открытие блокируется лимитами экспозиции и cooldown'ом;
- сигнал без сценария выхода невозможен: план строится вместе с сигналом (стоп,
  TP-лестница, invalidation, полный выход);
- неограниченное проскальзывание невозможно: impact сверх лимита — hard rejection,
  paper-fill без данных о ликвидности отклоняется;
- seed-фразы/приватные ключи нигде не запрашиваются и не хранятся.

## Сопровождение позиции (monitor, каждые 30с)

1. Отток ликвидности < 60% от входа → аварийный полный выход (rug в процессе).
2. Цена ≤ стопа (−35%) → полный выход.
3. TP-лестница: 1.5x → 33%, 2x → 33%, 4x → 34% (задаётся планом).
4. Крупные изменения unrealized P&L (≥25 п.п.) — событие в журнале.
5. Нет свежих данных → ALERT в журнале позиции, мониторинг деградирован.

Каждое действие пишется в PositionEvent (audit trail) и AuditLog.
