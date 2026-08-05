# Backtest (2026-08-05T01:56:59Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 48, но измеримых исходов на горизонте 24h только 14 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 48,
    "horizon": "24h",
    "evaluable": 14,
    "winRate": 0.2857142857142857,
    "expectancy": -0.1408050354524663,
    "medianReturn": -0.09724535058678713,
    "profitFactor": 0.30320964464431743,
    "maxDrawdown": 0.9993358513197375,
    "rugRate": 0.020833333333333332,
    "unclosablePct": 0.2916666666666667,
    "byMonth": {
      "2026-08": {
        "n": 14,
        "meanReturn": -0.1408050354524663
      }
    }
  },
  "baseline": {
    "signals": 1997,
    "horizon": "24h",
    "evaluable": 0,
    "winRate": null,
    "expectancy": null,
    "medianReturn": null,
    "profitFactor": null,
    "maxDrawdown": null,
    "rugRate": 0,
    "unclosablePct": 1,
    "byMonth": {}
  },
  "verdict": "NO_DATA: сигналов 48, но измеримых исходов на горизонте 24h только 14 (< 20). Выводов о преимуществе сделать нельзя."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -12.4% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 48,
    "horizon": "6h",
    "evaluable": 20,
    "winRate": 0.3,
    "expectancy": -0.12359814531604715,
    "medianReturn": -0.03755991680578746,
    "profitFactor": 0.2870219227116841,
    "maxDrawdown": 0.9995981553141903,
    "rugRate": 0.020833333333333332,
    "unclosablePct": 0.2916666666666667,
    "byMonth": {
      "2026-08": {
        "n": 20,
        "meanReturn": -0.12359814531604715
      }
    }
  },
  "baseline": {
    "signals": 1997,
    "horizon": "6h",
    "evaluable": 0,
    "winRate": null,
    "expectancy": null,
    "medianReturn": null,
    "profitFactor": null,
    "maxDrawdown": null,
    "rugRate": 0,
    "unclosablePct": 1,
    "byMonth": {}
  },
  "verdict": "NO EDGE: expectancy -12.4% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
