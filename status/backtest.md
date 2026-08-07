# Backtest (2026-08-07T06:31:48Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -8.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 85,
    "horizon": "24h",
    "evaluable": 31,
    "winRate": 0.5161290322580645,
    "expectancy": -0.08047777920287097,
    "medianReturn": 0.015851320906265176,
    "profitFactor": 0.5537294536131098,
    "maxDrawdown": 1.0000017671852577,
    "rugRate": 0.12857142857142856,
    "rugMeasurable": 70,
    "unclosablePct": 0.17647058823529413,
    "byMonth": {
      "2026-08": {
        "n": 31,
        "meanReturn": -0.08047777920287097
      }
    }
  },
  "baseline": {
    "signals": 405,
    "horizon": "24h",
    "evaluable": 2,
    "winRate": 0.5,
    "expectancy": -0.07746387893809437,
    "medianReturn": -0.07746387893809437,
    "profitFactor": 0.2477040103886669,
    "maxDrawdown": 0.2059398960191596,
    "rugRate": 0.17073170731707318,
    "rugMeasurable": 41,
    "unclosablePct": 0.9135802469135802,
    "byMonth": {
      "2026-08": {
        "n": 2,
        "meanReturn": -0.07746387893809437
      }
    }
  },
  "verdict": "NO EDGE: expectancy -8.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -13.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 85,
    "horizon": "6h",
    "evaluable": 55,
    "winRate": 0.43636363636363634,
    "expectancy": -0.13119857663916548,
    "medianReturn": -0.01404605444035223,
    "profitFactor": 0.3308519349179342,
    "maxDrawdown": 1.0000000003831415,
    "rugRate": 0.08695652173913043,
    "rugMeasurable": 69,
    "unclosablePct": 0.18823529411764706,
    "byMonth": {
      "2026-08": {
        "n": 55,
        "meanReturn": -0.13119857663916548
      }
    }
  },
  "baseline": {
    "signals": 405,
    "horizon": "6h",
    "evaluable": 27,
    "winRate": 0.07407407407407407,
    "expectancy": -0.43254219065774985,
    "medianReturn": -0.2013776022915753,
    "profitFactor": 0.05785212473431459,
    "maxDrawdown": 1.0000000016400872,
    "rugRate": 0.17073170731707318,
    "rugMeasurable": 41,
    "unclosablePct": 0.9135802469135802,
    "byMonth": {
      "2026-08": {
        "n": 27,
        "meanReturn": -0.43254219065774996
      }
    }
  },
  "verdict": "NO EDGE: expectancy -13.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
