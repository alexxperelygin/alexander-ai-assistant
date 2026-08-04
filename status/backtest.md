# Backtest (2026-08-04T20:38:53Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 46, но измеримых исходов на горизонте 24h только 12 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 46,
    "horizon": "24h",
    "evaluable": 12,
    "winRate": 0.25,
    "expectancy": -0.12812256790842805,
    "medianReturn": -0.09724535058678713,
    "profitFactor": 0.35808559322374867,
    "maxDrawdown": 0.99882259361966,
    "rugRate": 0.021739130434782608,
    "unclosablePct": 0.2826086956521739,
    "byMonth": {
      "2026-08": {
        "n": 12,
        "meanReturn": -0.12812256790842805
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
  "verdict": "NO_DATA: сигналов 46, но измеримых исходов на горизонте 24h только 12 (< 20). Выводов о преимуществе сделать нельзя."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 46, но измеримых исходов на горизонте 6h только 19 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 46,
    "horizon": "6h",
    "evaluable": 19,
    "winRate": 0.3157894736842105,
    "expectancy": -0.13341035784363028,
    "medianReturn": -0.04141129419580525,
    "profitFactor": 0.2630968267911327,
    "maxDrawdown": 0.9995981553141903,
    "rugRate": 0.021739130434782608,
    "unclosablePct": 0.2826086956521739,
    "byMonth": {
      "2026-08": {
        "n": 19,
        "meanReturn": -0.13341035784363028
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
  "verdict": "NO_DATA: сигналов 46, но измеримых исходов на горизонте 6h только 19 (< 20). Выводов о преимуществе сделать нельзя."
}
