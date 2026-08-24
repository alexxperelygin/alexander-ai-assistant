# MemeScope AI — статус сервера

Сгенерирован: 2026-08-24T13:11:51.129Z (UTC)

## Ядро
- Worker: ✅ работает (последний цикл: 3 мин назад)
- Токенов в базе: 770418; снапшотов за 24ч: 34662
- Ошибок в audit log за 24ч: 0
- memescope-web:  online, память 77 МБ, перезапусков 0
- memescope-worker:  online, память 77 МБ, перезапусков 0
- дашборд: ✅ отвечает (HTTP 200, 265 мс, порт 3000)

## Действующие пороги
- минимальная ликвидность: $50 000
- размер позиции ≤ $50; риск на сделку 1%; slippage ≤ 3%
- возраст токена: 20–10080 мин; живая торговля: выключена

## Новые токены за 24ч по сетям
- solana: 19434
- robinhood: 3179
- bsc: 2851
- base: 1721
- ethereum: 206
- arbitrum: 16

## Статусы возможностей
- AVOID: 120436
- DATA_UNAVAILABLE: 35028
- CANDIDATE: 10
- WATCH: 5
- READY: 2

## Топ-5 по score (не отбракованные)
- testicle: READY, score 65.7, risk 0.3, conf 100% (обновлено 3.1 дн назад)
- CHEEMS: READY, score 65.5, risk 2.0, conf 100% (обновлено 18.4 дн назад)
- GINGY: CANDIDATE, score 64.8, risk 0.9, conf 100% (обновлено 19.0 дн назад)
- KINS: CANDIDATE, score 63.7, risk 1.5, conf 100% (обновлено 21.3 дн назад)
- GLOW: CANDIDATE, score 59.0, risk 7.7, conf 100% (обновлено 18.4 дн назад)

## READY-сигналы (последние 5 за всё время)
- XST — 2026-08-23T19:41:26.832Z (17.5 ч назад)
- XST — 2026-08-23T19:07:42.898Z (18.1 ч назад)
- XST — 2026-08-23T18:29:31.590Z (18.7 ч назад)
- memes — 2026-08-23T16:15:36.739Z (20.9 ч назад)
- memes — 2026-08-23T00:51:21.884Z (1.5 дн назад)

## Социальные источники (24ч)
- снимков нет: ни один ключ не настроен, либо ни один токен ещё не прошёл порог ликвидности

## Последние переходы статусов
- QEANT: — → AVOID (0 мин назад) — [sell-not-verified] В сети Base продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверждени
- KOI: — → AVOID (0 мин назад) — [sell-not-verified] В сети BNB Chain продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтвер
- XCAT: — → AVOID (3 мин назад) — [sell-not-verified] В сети BNB Chain продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтвер
- Barron: — → AVOID (3 мин назад) — [sell-not-verified] В сети Ethereum продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверж
- NUDIST: — → DATA_UNAVAILABLE (3 мин назад) — Ключевые данные отсутствуют или устарели — решение невозможно. | Недостаточно данных для решения: priceUsd, liquidityUsd, volume24
- CAT: — → AVOID (4 мин назад) — [sell-not-verified] В сети Base продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверждени
- 小玉: — → AVOID (4 мин назад) — [sell-not-verified] В сети BNB Chain продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтвер
- SHARKBUX: — → AVOID (4 мин назад) — [sell-not-verified] В сети Ethereum продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверж
- SAVPIL: — → DATA_UNAVAILABLE (4 мин назад) — Ключевые данные отсутствуют или устарели — решение невозможно. | Недостаточно данных для решения: priceUsd, liquidityUsd, volume24
- BaseHub: — → AVOID (5 мин назад) — [sell-not-verified] В сети Base продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверждени
- 牛B: — → AVOID (5 мин назад) — [sell-not-verified] В сети BNB Chain продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтвер
- CELESTIAL: — → AVOID (5 мин назад) — [sell-not-verified] В сети Ethereum продажа не симулируется, а проверка контракта не подтвердила возможность продать. Без подтверж

## Позиции
- Открытых: 41; всего: 308; realized P&L: $5758.74
- по замороженным правилам (после 2026-08-08): 236 закрытых, $6287.52; по старым правилам: 17 закрытых, $-582.61
  · из них прибыльных 47 из 236
- трек «проверенное правило (ликвидность > $50k)»: открыто 25, закрыто 116, P&L $651.24, прибыльных 39 из 116, медиана сделки -1.4%; из них 29 закрыто по устаревшей цене, без них итог $669.90 по 87 сделкам; если все они на деле обнулились — $-780.10
  · крупнейшая сделка трека: BINIU $881.26 (1763% от входа $50.00); без неё итог трека $-230.02 по 115 сделкам
    сверить: вход $5.729e-8, максимум $0.000003346, https://dexscreener.com/bsc/0x2ca3d3b737d8db7e6df4475aa36f0d7071259b57
- трек «низкая ликвидность $10k–$50k (лотерейный трек)»: открыто 15, закрыто 99, P&L $5755.41, прибыльных 4 из 99, медиана сделки -2.5%; из них 63 закрыто по устаревшей цене, без них итог $5838.13 по 36 сделкам; если все они на деле обнулились — $2688.13
  · крупнейшая сделка трека: LILPEPE $4164.32 (8329% от входа $50.00); без неё итог трека $1591.10 по 98 сделкам
    сверить: вход $1.834e-7, максимум $0.00001626, https://dexscreener.com/bsc/0x58b665d1ff4d5438b3e755987104d5825bc3393b
- трек «конвейер READY (backtest: NO EDGE)»: открыто 1, закрыто 38, P&L $-701.74, прибыльных 5 из 38, медиана сделки -21.7%; из них 4 закрыто по устаревшей цене, без них итог $-703.75 по 34 сделкам; если все они на деле обнулились — $-783.75
  · крупнейшая сделка трека: FWA $6.08 (30% от входа $20.00); без неё итог трека $-707.82 по 37 сделкам
    сверить: вход $0.01909, максимум $0.03602, https://dexscreener.com/ethereum/0xa0df17b5ac76ababa36e1450e2cbcd18a620c845
  · ⚠️ по лотерейному треку закрыто 99 сделок из 300 минимально нужных — на хвостовом распределении это ещё не результат
  · пропущено токенов за 24ч (нет свободного слота): 106 при 25+15 слотах — выборка треков этим смещена, см. docs/PREREGISTRATION.md
- ⚠️ исключено как НЕИЗМЕРИМЫЕ: 14 шт (5.2% от всех завершённых) — цену выхода получить не удалось: либо её не было ни в одном источнике, либо выход не исполнялся. Эти сделки не входят ни в один итог выше. Рост этой доли завышает результаты треков: источник перестаёт котировать прежде всего умершие токены
- ⚠️ списано полностью (пул не может принять позицию): 8 шт на $-400.00 — входит в итоги выше. Цена выхода взята нулевой: это допущение в консервативную сторону, а не измерение
- из них закрыто по устаревшей цене (результат недостоверен): 96 шт на $-99.36 — эта часть суммы выше является допущением, а не измерением
- ⚠️ цены нет ни из одного источника, стоп и трейлинг НЕ проверяются: SOLdiers (алерт 3 мин назад, позиции 469.6 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), CC (алерт 9 мин назад, позиции 72.0 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), CANTON (алерт 3 мин назад, позиции 72.0 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), LRC (алерт 3 мин назад, позиции 61.0 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), SAND (алерт 3 мин назад, позиции 60.6 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), PENGU (алерт 2 мин назад, позиции 59.7 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), Gio (алерт 2 мин назад, позиции 37.1 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), DTCC ALPACA FINANCE (алерт 2 мин назад, позиции 34.8 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), WBT (алерт 2 мин назад, позиции 33.9 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), Bitcoin Company (алерт 2 мин назад, позиции 22.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), 牛来 (алерт 1 мин назад, позиции 21.8 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), CYBERLEEK (алерт 1 мин назад, позиции 21.4 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), GRUMPYSHITCOIN (алерт 1 мин назад, позиции 21.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), CTR (алерт 1 мин назад, позиции 20.5 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), CYBERLEEK (алерт 1 мин назад, позиции 20.4 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), AVELEN (алерт 7 мин назад, позиции 19.4 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), PUMP (алерт 0 мин назад, позиции 19.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), OWLCAT (алерт 19 мин назад, позиции 19.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), MENTE (алерт 0 мин назад, позиции 19.1 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), OMEN (алерт 0 мин назад, позиции 18.8 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), XAUt (алерт 6 мин назад, позиции 18.7 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), CYBERCAT (алерт 6 мин назад, позиции 18.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), ARB (алерт 6 мин назад, позиции 13.0 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), kDOS (алерт 5 мин назад, позиции 12.8 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), LFI (алерт 5 мин назад, позиции 11.6 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), FIL (алерт 5 мин назад, позиции 11.4 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), sUSDat (алерт 11 мин назад, позиции 10.1 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), sENA (алерт 5 мин назад, позиции 9.7 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), wXRP (алерт 11 мин назад, позиции 8.9 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), DISCOPUSSY (алерт 11 мин назад, позиции 8.8 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), SALTY (алерт 11 мин назад, позиции 8.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), MONEY (алерт 4 мин назад, позиции 7.7 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), 羊王 (алерт 4 мин назад, позиции 7.6 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), wXRPN (алерт 4 мин назад, позиции 7.4 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), DTCC Ripple XRP (алерт 4 мин назад, позиции 7.3 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), WOFI (алерт 10 мин назад, позиции 7.0 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), BNB Chain (алерт 4 мин назад, позиции 2.1 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»), XRPAYNET (алерт 16 мин назад, позиции 1.0 ч; «Ошибка мониторинга: TimeoutError: The operation was aborted due to tim»)

## Последние позиции (детально)
- XRPAYNET [paper/OPEN] вход $0.0003015 × 165256 = $50.00, остаток 100%, realized $0.00
    · 12:56:11 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 12:49:56 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- XRPC [paper/OPEN] вход $0.0002279 × 218644 = $50.00, остаток 100%, realized $0.00
    · 12:31:28 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 12:20:07 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- BNB Chain [paper/OPEN] вход $0.00002294 × 2171893 = $50.00, остаток 100%, realized $0.00
    · 13:08:21 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 12:43:21 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- XPR NETWORK [paper/OPEN] вход $0.0001726 × 288645 = $50.00, остаток 100%, realized $0.00
    · 12:19:47 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 12:13:42 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- MONE [paper/STOPPED] вход $0.0003931 × 126765 = $50.00, остаток 0%, realized $-10.95, закрыта: Stop: цена $0.000310500 ≤ стопа $0.000314441
    · 07:08:45 [STOP_HIT] Stop: цена $0.000310500 ≤ стопа $0.000314441: продано 126764.62 шт по $0.000309234, P&L $-10.95
    · 06:44:40 [OPEN] Paper вход по проверенному правилу: 126764.62 шт по $0.000393051 (комиссии $0.17, impact 0.12%)
- WOFI [paper/OPEN] вход $0.0006137 × 81192 = $50.00, остаток 100%, realized $0.00
    · 13:02:04 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 12:49:27 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- DTCC Ripple XRP [paper/OPEN] вход $0.00008824 × 564624 = $50.00, остаток 100%, realized $0.00
    · 13:07:59 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 13:01:54 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- wXRPN [paper/OPEN] вход $0.0002393 × 208197 = $50.00, остаток 100%, realized $0.00
    · 13:07:49 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 13:01:44 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- 羊王 [paper/OPEN] вход $11.38 × 4 = $50.00, остаток 100%, realized $0.00
    · 13:07:39 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 13:01:34 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
- MONEY [paper/OPEN] вход $1.177e-7 × 423243663 = $50.00, остаток 100%, realized $0.00
    · 13:07:29 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout
    · 13:01:24 [ALERT] Ошибка мониторинга: TimeoutError: The operation was aborted due to timeout

## Последний backtest
- DONE (4.5 ч назад): NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.

## Источники данных
- dexscreener: 🔴 The operation was aborted due to timeout (ok 2053866 / err 933, последний успех 0 мин назад)
- geckoterminal: ok (ok 18536 / err 1, последний успех 18.3 дн назад)
- geckoterminal:arbitrum: ok (ok 14227 / err 12065, последний успех 2 мин назад)
- geckoterminal:base: ok (ok 26261 / err 38, последний успех 2 мин назад)
- geckoterminal:bsc: ok (ok 25046 / err 1250, последний успех 2 мин назад)
- geckoterminal:eth: ok (ok 17805 / err 8490, последний успех 2 мин назад)
- geckoterminal:robinhood: 🔴 HTTP 429 https://api.geckoterminal.com/api/v2/networks/robinhood/new_pools?page=1 (ok 12880 / err 13391, последний успех 47 мин назад)
- geckoterminal:solana: ok (ok 26300 / err 0, последний успех 3 мин назад)
- goplus: ok (ok 46218 / err 12, последний успех 32 мин назад)
- jupiter: ok (ok 440895 / err 894, последний успех 1.6 ч назад)
- rugcheck: ok (ok 130567 / err 398, последний успех 1.8 ч назад)

