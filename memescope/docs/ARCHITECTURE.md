# Architecture

## Компоненты

```
┌────────────── Next.js app (src/app) ──────────────┐
│ Dashboard: Overview/Scanner/Opportunity/Positions │
│ Backtests/Signals/Settings/Health                 │
│ API routes: settings, positions, backtests        │
└─────────────────────┬─────────────────────────────┘
                      │ Prisma (SQLite dev / PostgreSQL prod)
┌─────────────────────┴─────────────────────────────┐
│ Worker (src/worker) — отдельный 24/7 процесс      │
│  scan loop (60s):                                 │
│   discovery → market snapshot → risk report →     │
│   sell-route quote → features → hard rejections → │
│   scoring → lifecycle decision → signal/notify    │
│  monitor loop (30s): позиции, стопы, TP, drain    │
└─────────────────────┬─────────────────────────────┘
                      │ Provider interfaces (src/lib/providers/types.ts)
   ┌────────────┬─────┴──────┬───────────┬──────────┐
   │GeckoTerminal│ DexScreener│  RugCheck │ Jupiter  │   + MockProvider (DATA_MODE=mock)
   │ discovery   │ market     │  risk     │ routes   │
   └────────────┴────────────┴───────────┴──────────┘
```

## Слои (src/lib)

| Слой | Модуль | Ответственность |
| --- | --- | --- |
| providers | `providers/*` | адаптеры внешних источников, throttle, health |
| ingestion | `ingestion/scanner.ts` | цикл сканирования, персистенция с provenance |
| normalization | `providers/*` → `types.ts` | приведение raw payload к MarketSnapshot/ContractRiskReport |
| feature computation | `features/compute.ts` | FeatureVector, dataGaps вместо выдуманных значений |
| risk engine | `risk/engine.ts` | hard rejections + continuous risk scores |
| scoring engine | `scoring/engine.ts` | компоненты + Meme Opportunity Score |
| strategy engine | `strategy/lifecycle.ts` | статусы, position sizing, торговый план |
| paper execution | `paper/execution.ts`, `paper/portfolio.ts` | реалистичные fill'ы, лимиты, P&L |
| position monitoring | `monitor/positions.ts` | стопы/TP/drain/алерты |
| notifications | `notify/notifier.ts` | in-app + Telegram |
| backtест | `backtest/*` | метрики, baseline, NO_DATA/NO EDGE |
| audit | AuditLog + SignalEvent + PositionEvent | воспроизводимость каждого решения |

## Provenance данных

Каждый `TokenSnapshot`/`RiskReport` хранит: `source`, `dataMode` (live/mock),
`fetchedAt`, `observedAt`, `freshnessMs`, усечённый `raw` payload и `errors`
(пропуски полей). Решения (`Opportunity`) хранят `featuresRef` — полный вектор
признаков на момент решения, поэтому любой BUY/AVOID воспроизводим.

## База данных

SQLite по умолчанию (нулевая настройка, dev/research). Для production:

1. в `prisma/schema.prisma` замените `provider = "sqlite"` на `"postgresql"`;
2. `DATABASE_URL=postgresql://user:pass@host:5432/memescope`;
3. `npx prisma migrate dev`.

Схема сознательно не использует SQLite-специфики (JSON хранится строками), поэтому
миграция — только смена провайдера. Обоснование выбора — docs/DECISIONS.md (ADR-1).

## Масштабирование

- Очередь: интервал-циклы worker'а заменяются BullMQ + Redis без изменения движков
  (движки — чистые функции; scan/monitor уже изолированы) — ADR-2.
- Новые сети (Base/Ethereum/BNB): реализуйте 4 интерфейса провайдеров для сети и
  добавьте `chain` в discovery; движки от сети не зависят.
- Замена источника: один класс-адаптер (например, Birdeye вместо DexScreener),
  регистрация в `providers/index.ts`.

## Ограничения среды

- Публичные API лимитированы: GeckoTerminal ~30 req/min, Jupiter lite ~1 rps,
  RugCheck — бережно (кэш отчётов 10 мин). Throttle в `providers/http.ts`,
  батч кандидатов — `MAX_CANDIDATES_PER_CYCLE`.
- `NODE_ENV` в некоторых окружениях предустановлен в development: build-скрипт
  принудительно ставит production.
