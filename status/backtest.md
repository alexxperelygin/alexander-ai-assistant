# Backtest (2026-08-06T08:39:40Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -3.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 76,
    "horizon": "24h",
    "evaluable": 24,
    "winRate": 0.4583333333333333,
    "expectancy": -0.0391588149015907,
    "medianReturn": -0.009801340873733189,
    "profitFactor": 0.738435089737064,
    "maxDrawdown": 1.000001682713477,
    "rugRate": 0.11475409836065574,
    "rugMeasurable": 61,
    "unclosablePct": 0.19736842105263158,
    "byMonth": {
      "2026-08": {
        "n": 24,
        "meanReturn": -0.039158814901590705
      }
    }
  },
  "baseline": {
    "signals": 490,
    "horizon": "24h",
    "evaluable": 3,
    "winRate": 0.6666666666666666,
    "expectancy": 0.03369490252159638,
    "medianReturn": 0.017080839734407105,
    "profitFactor": 51.942130314234326,
    "maxDrawdown": 0.0019843046794716587,
    "rugRate": 0.1,
    "rugMeasurable": 20,
    "unclosablePct": 0.9653061224489796,
    "byMonth": {
      "2026-08": {
        "n": 3,
        "meanReturn": 0.03369490252159638
      }
    }
  },
  "verdict": "NO EDGE: expectancy -3.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -15.4% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 76,
    "horizon": "6h",
    "evaluable": 46,
    "winRate": 0.41304347826086957,
    "expectancy": -0.15426424901360136,
    "medianReturn": -0.019213281967285167,
    "profitFactor": 0.31263712455703435,
    "maxDrawdown": 1.0000000003831415,
    "rugRate": 0.11475409836065574,
    "rugMeasurable": 61,
    "unclosablePct": 0.19736842105263158,
    "byMonth": {
      "2026-08": {
        "n": 46,
        "meanReturn": -0.15426424901360136
      }
    }
  },
  "baseline": {
    "signals": 490,
    "horizon": "6h",
    "evaluable": 8,
    "winRate": 0.5,
    "expectancy": 0.4481036594885158,
    "medianReturn": 0.06054256375253847,
    "profitFactor": 57.85018957419195,
    "maxDrawdown": 0.030020831429481618,
    "rugRate": 0.1,
    "rugMeasurable": 20,
    "unclosablePct": 0.9653061224489796,
    "byMonth": {
      "2026-08": {
        "n": 8,
        "meanReturn": 0.4481036594885158
      }
    }
  },
  "verdict": "NO EDGE: expectancy -15.4% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
