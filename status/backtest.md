# Backtest (2026-08-04T03:37:42Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 29, но измеримых исходов на горизонте 24h только 7 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 29,
    "horizon": "24h",
    "evaluable": 7,
    "winRate": 0.42857142857142855,
    "expectancy": 0.05674718682299979,
    "medianReturn": -0.030245455462505788,
    "profitFactor": 1.8627328846095874,
    "maxDrawdown": 0.30550896216476187,
    "rugRate": 0,
    "unclosablePct": 0.27586206896551724,
    "byMonth": {
      "2026-08": {
        "n": 7,
        "meanReturn": 0.05674718682299979
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
  "verdict": "NO_DATA: сигналов 29, но измеримых исходов на горизонте 24h только 7 (< 20). Выводов о преимуществе сделать нельзя."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 29, но измеримых исходов на горизонте 6h только 11 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 29,
    "horizon": "6h",
    "evaluable": 11,
    "winRate": 0.45454545454545453,
    "expectancy": -0.05832327077629779,
    "medianReturn": -0.0023308925439567973,
    "profitFactor": 0.4685927244950186,
    "maxDrawdown": 0.8117377762072445,
    "rugRate": 0,
    "unclosablePct": 0.27586206896551724,
    "byMonth": {
      "2026-08": {
        "n": 11,
        "meanReturn": -0.05832327077629779
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
  "verdict": "NO_DATA: сигналов 29, но измеримых исходов на горизонте 6h только 11 (< 20). Выводов о преимуществе сделать нельзя."
}
