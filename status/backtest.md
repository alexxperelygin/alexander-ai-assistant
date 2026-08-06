# Backtest (2026-08-06T21:35:55Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 80, но измеримых исходов на горизонте 24h только 3 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 80,
    "horizon": "24h",
    "evaluable": 3,
    "winRate": 0.3333333333333333,
    "expectancy": -0.09588587561817503,
    "medianReturn": -0.08068351723158174,
    "profitFactor": 0.09078417693166,
    "maxDrawdown": 0.27718176168806563,
    "rugRate": 0.09230769230769231,
    "rugMeasurable": 65,
    "unclosablePct": 0.1875,
    "byMonth": {
      "2026-08": {
        "n": 3,
        "meanReturn": -0.09588587561817503
      }
    }
  },
  "baseline": {
    "signals": 441,
    "horizon": "24h",
    "evaluable": 0,
    "winRate": null,
    "expectancy": null,
    "medianReturn": null,
    "profitFactor": null,
    "maxDrawdown": null,
    "rugRate": 0.17647058823529413,
    "rugMeasurable": 34,
    "unclosablePct": 0.9478458049886621,
    "byMonth": {}
  },
  "verdict": "NO_DATA: сигналов 80, но измеримых исходов на горизонте 24h только 3 (< 20). Выводов о преимуществе сделать нельзя."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -12.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 80,
    "horizon": "6h",
    "evaluable": 51,
    "winRate": 0.47058823529411764,
    "expectancy": -0.12877197669991525,
    "medianReturn": -0.008529781213932108,
    "profitFactor": 0.3663688657990841,
    "maxDrawdown": 1.0000000005414404,
    "rugRate": 0.09375,
    "rugMeasurable": 64,
    "unclosablePct": 0.2,
    "byMonth": {
      "2026-08": {
        "n": 51,
        "meanReturn": -0.12877197669991525
      }
    }
  },
  "baseline": {
    "signals": 441,
    "horizon": "6h",
    "evaluable": 16,
    "winRate": 0.0625,
    "expectancy": -0.4837088969390192,
    "medianReturn": -0.3514891288602333,
    "profitFactor": 0.017169501376322657,
    "maxDrawdown": 1.0000000837273362,
    "rugRate": 0.17647058823529413,
    "rugMeasurable": 34,
    "unclosablePct": 0.9478458049886621,
    "byMonth": {
      "2026-08": {
        "n": 16,
        "meanReturn": -0.48370889693901925
      }
    }
  },
  "verdict": "NO EDGE: expectancy -12.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
