# MemeScope AI

Исследовательский MVP: круглосуточный сканер новых мем-коинов Solana с прозрачной
оценкой, hard-rejection фильтрами рисков, paper trading и журналом качества сигналов.

> **Честное позиционирование.** Это исследовательский инструмент, а не машина прибыли.
> Система не исполняет реальные сделки, не запрашивает seed-фразы/приватные ключи и не
> обещает доходность. Пока out-of-sample backtest не подтвердит положительное
> математическое ожидание после издержек, единственный честный вердикт — **NO EDGE**,
> и система его показывает.

## Что уже работает

- **Реальные данные без API-ключей**: GeckoTerminal (новые пулы), DexScreener (цена,
  ликвидность, объёмы, транзакции), RugCheck (mint/freeze authority, концентрация
  держателей, LP lock, rug-флаги), Jupiter (котировки, price impact, проверка
  продаваемости token→SOL).
- **Прозрачный Meme Opportunity Score 0–100** — каждая компонента имеет формулу и
  объяснение, случайных чисел нет (docs/SCORING_MODEL.md).
- **Hard rejection rules** — mint/freeze authority, непродаваемость, концентрация,
  ликвидность, wash-trading, устаревшие данные (docs/RISK_MODEL.md).
- **Жизненный цикл сигнала**: WATCH → CANDIDATE → READY → BUY/HOLD → TAKE_PROFIT →
  EXIT / INVALIDATED / AVOID / DATA_UNAVAILABLE, с причинами каждого перехода.
- **Paper trading** с реалистичным исполнением: комиссия DEX, сетевые сборы, price
  impact от глубины пула, дрейф задержки; стопы, лестница take-profit, аварийный
  выход при оттоке ликвидности.
- **Сопровождение ручных сделок**: кнопка "I bought" фиксирует фактическую цену/размер,
  дальше система мониторит позицию и шлёт уведомления (in-app + опционально Telegram).
- **Backtest-фреймворк** по накопленным системой данным: издержки, baseline "покупать
  всё подряд", win rate / expectancy / profit factor / max drawdown / rug rate; при
  нехватке данных честно возвращает NO_DATA.
- **Dashboard** (тёмная тема): Overview, Live Scanner, Opportunity Details, Positions,
  Backtests, Signal History, Settings, System Health. Mock-данные всегда помечены.

## Быстрый старт

```bash
cd memescope
npm install
cp .env.example .env          # значения по умолчанию работают без ключей
npx prisma db push            # создать SQLite-базу

# Терминал 1: дашборд
npm run dev                   # http://localhost:3000

# Терминал 2: 24/7 сканер + мониторинг позиций
npm run worker                # реальные данные (DATA_MODE=live)
# или npm run worker:mock     # вымышленные данные для разработки (помечены MOCK)

# Backtest по накопленным данным
npm run backtest -- --horizon 24h --mode live

# Тесты и проверка типов
npm test && npm run typecheck
```

Worker должен работать постоянно: чем дольше он собирает снапшоты, тем больше
материала для backtest и оценки качества сигналов.

## Документация

| Файл | Содержание |
| --- | --- |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Цель, сценарий пользователя, критерии готовности MVP |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Модули, поток данных, схема БД, миграция на PostgreSQL |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Таблица источников: API, лимиты, стоимость, замены |
| [docs/SCORING_MODEL.md](docs/SCORING_MODEL.md) | Формулы всех компонент score и rejection rules |
| [docs/RISK_MODEL.md](docs/RISK_MODEL.md) | Position sizing, лимиты, kill switch |
| [docs/BACKTEST_METHODOLOGY.md](docs/BACKTEST_METHODOLOGY.md) | Методология, контроль bias, издержки, NO EDGE policy |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Статус этапов и план развития |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Журнал архитектурных решений (ADR) |

## Ограничения текущей версии (важно)

1. **Исторического датасета ещё нет** — система накапливает его сама. Строгий вывод
   об edge возможен только после недель сбора данных или подключения платного
   исторического источника (Birdeye).
2. **Социальный модуль — заглушка** (наличие сайта/соцсетей); официальные соц-API — в ROADMAP.
3. **Количество держателей** доступно ограниченно (RugCheck totalHolders); полноценные
   holder-метрики требуют Helius/Birdeye ключа.
4. Пороги scoring выбраны эвристически и **не подтверждены** историческим тестом —
   это стартовая точка исследования, а не проверенная стратегия.
