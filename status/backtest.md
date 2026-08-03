# Backtest (2026-08-03T03:04:34Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -10.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 34,
    "horizon": "24h",
    "evaluable": 3,
    "winRate": 0.3333333333333333,
    "expectancy": -0.10801158061839837,
    "medianReturn": -0.11502849024247752,
    "profitFactor": 0.07609995508289824,
    "maxDrawdown": 0.3055602221799515,
    "rugRate": 0,
    "unclosablePct": 0.4411764705882353,
    "byMonth": {
      "2026-08": {
        "n": 3,
        "meanReturn": -0.10801158061839837
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
  "verdict": "NO EDGE: expectancy -10.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
PRELIMINARY EDGE: expectancy 0.3% > baseline 0.0%. Требуется больше данных и out-of-sample подтверждение прежде чем доверять.
{
  "strategy": {
    "signals": 34,
    "horizon": "6h",
    "evaluable": 2,
    "winRate": 0.5,
    "expectancy": 0.0025872596342169096,
    "medianReturn": 0.0025872596342169096,
    "profitFactor": 1.1535076677339824,
    "maxDrawdown": 0.03370853941576968,
    "rugRate": 0,
    "unclosablePct": 0.4411764705882353,
    "byMonth": {
      "2026-08": {
        "n": 2,
        "meanReturn": 0.0025872596342169096
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
  "verdict": "PRELIMINARY EDGE: expectancy 0.3% > baseline 0.0%. Требуется больше данных и out-of-sample подтверждение прежде чем доверять."
}
