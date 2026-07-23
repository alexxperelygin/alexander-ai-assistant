# Data Sources

Статус на 2026-07 (проверено живыми запросами из этого проекта). Все интеграции идут
через интерфейсы адаптеров (`src/lib/providers/types.ts`) и заменяемы. Обход
авторизации/лимитов не используется; соблюдаются публичные условия сервисов.

## Сводная таблица

| Источник | Данные | Официальный API | Стоимость | Rate limit | Задержка | Надёжность | MVP | Замена |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **GeckoTerminal** | новые пулы, цены, OHLCV | да, публичный | бесплатно | ~30 req/min | секунды–минуты | высокая | **да** (discovery) | Birdeye, DexScreener profiles |
| **DexScreener** | пары: цена, ликвидность, объёмы m5/h1/h24, buys/sells, socials | да, публичный | бесплатно | 300 req/min | ~реальное время | высокая | **да** (market data) | Birdeye, GeckoTerminal |
| **RugCheck** | mint/freeze authority, top holders, insiders, LP lock, rug-флаги | да, публичный | бесплатно | не документирован — кэшируем 10 мин, ~0.5 rps | секунды | средняя | **да** (risk) | GoPlus, свой RPC-анализ |
| **Jupiter (lite-api)** | котировки, price impact, маршруты, цены | да, публичный | бесплатно | ~1 rps | реальное время | высокая | **да** (sellability, impact) | платный Jupiter tier, Raydium API |
| **Solana RPC** | on-chain: supply, аккаунты, holders | да | бесплатно (публичный узел лимитирован) | жёсткие на mainnet-beta | реальное время | средняя (публичный узел) | нет (опция) | Helius, Triton, QuickNode |
| **Helius** | DAS, holders, webhooks, кошельковая активность | да | free tier + платно | по тарифу | реальное время | высокая | нет — ключ в .env активирует | Birdeye |
| **Birdeye** | исторические OHLCV, trades, holders, smart money | да | платно (есть free tier с урезкой) | по тарифу | реальное время | высокая | нет — нужен для глубокого backtest | GeckoTerminal (частично) |
| **GoPlus** | security-скан токена | да, публичный | бесплатно | умеренные | секунды | средняя | нет (дублирует RugCheck) | RugCheck |
| **Pump.fun** | pre-graduation токены | официального публичного API нет | — | — | — | — | нет | PumpPortal (сторонний, ToS-риск — не используем); токены подхватываются после выхода на DEX через GeckoTerminal |
| **X/Twitter API** | упоминания, авторы | да | $200+/мес (basic) | по тарифу | минуты | высокая | нет — дорого для MVP | Farcaster API (бесплатно), LunarCrush |
| **Telegram Bot API** | уведомления (исходящие) | да | бесплатно | щедрые | реальное время | высокая | опция | email |

## Что используется в MVP

- **Discovery**: GeckoTerminal `GET /networks/solana/new_pools`.
- **Market**: DexScreener `GET /latest/dex/tokens/{mint}` (самый ликвидный пул).
- **Risk**: RugCheck `GET /v1/tokens/{mint}/report` (кэш 10 минут).
- **Исполнимость**: Jupiter `GET /swap/v1/quote` в обе стороны — подтверждение
  продаваемости и реальный price impact; `GET /price/v3` для цены SOL.

## Правила работы с источниками

1. Каждый вызов проходит через `fetchJson` с таймаутом, throttle и записью в
   `SourceHealth` (ошибки видны на странице System Health).
2. Отказ источника не валит цикл: признак становится null, попадает в `dataGaps`,
   confidence снижается, при нехватке ядра данных статус — DATA_UNAVAILABLE.
3. Mock-режим (`DATA_MODE=mock`) полностью изолирован и помечается в БД и UI.
