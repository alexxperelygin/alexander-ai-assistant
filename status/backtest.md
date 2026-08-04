# Backtest (2026-08-04T12:40:20Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 41, но измеримых исходов на горизонте 24h только 10 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 41,
    "horizon": "24h",
    "evaluable": 10,
    "winRate": 0.4,
    "expectancy": -0.01714422741201953,
    "medianReturn": -0.05960803341128312,
    "profitFactor": 0.8340236226649215,
    "maxDrawdown": 0.5012191385359461,
    "rugRate": 0.024390243902439025,
    "unclosablePct": 0.3170731707317073,
    "byMonth": {
      "2026-08": {
        "n": 10,
        "meanReturn": -0.01714422741201953
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
  "verdict": "NO_DATA: сигналов 41, но измеримых исходов на горизонте 24h только 10 (< 20). Выводов о преимуществе сделать нельзя."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 41, но измеримых исходов на горизонте 6h только 14 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 41,
    "horizon": "6h",
    "evaluable": 14,
    "winRate": 0.35714285714285715,
    "expectancy": -0.132693317797374,
    "medianReturn": -0.03755991680578746,
    "profitFactor": 0.28847649118472374,
    "maxDrawdown": 0.9988960837373924,
    "rugRate": 0.024390243902439025,
    "unclosablePct": 0.3170731707317073,
    "byMonth": {
      "2026-08": {
        "n": 14,
        "meanReturn": -0.132693317797374
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
  "verdict": "NO_DATA: сигналов 41, но измеримых исходов на горизонте 6h только 14 (< 20). Выводов о преимуществе сделать нельзя."
}
