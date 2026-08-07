# Backtest (2026-08-07T16:38:55Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 90,
    "horizon": "24h",
    "evaluable": 36,
    "winRate": 0.5277777777777778,
    "expectancy": -0.056659837711934974,
    "medianReturn": 0.02661310352654811,
    "profitFactor": 0.6426775467563562,
    "maxDrawdown": 1.0000017671852577,
    "rugRate": 0.12,
    "rugMeasurable": 75,
    "unclosablePct": 0.16666666666666666,
    "byMonth": {
      "2026-08": {
        "n": 36,
        "meanReturn": -0.056659837711934974
      }
    }
  },
  "baseline": {
    "signals": 373,
    "horizon": "24h",
    "evaluable": 10,
    "winRate": 0.1,
    "expectancy": -0.25806703974579187,
    "medianReturn": -0.03696851845822957,
    "profitFactor": 0.37347927638507394,
    "maxDrawdown": 1.0009563784082927,
    "rugRate": 0.16326530612244897,
    "rugMeasurable": 49,
    "unclosablePct": 0.8873994638069705,
    "byMonth": {
      "2026-08": {
        "n": 10,
        "meanReturn": -0.25806703974579187
      }
    }
  },
  "verdict": "NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -11.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 90,
    "horizon": "6h",
    "evaluable": 60,
    "winRate": 0.4666666666666667,
    "expectancy": -0.11523045712257234,
    "medianReturn": -0.003685374698758348,
    "profitFactor": 0.35916529167167704,
    "maxDrawdown": 1.0000000003831415,
    "rugRate": 0.08108108108108109,
    "rugMeasurable": 74,
    "unclosablePct": 0.17777777777777778,
    "byMonth": {
      "2026-08": {
        "n": 60,
        "meanReturn": -0.11523045712257234
      }
    }
  },
  "baseline": {
    "signals": 373,
    "horizon": "6h",
    "evaluable": 32,
    "winRate": 0.03125,
    "expectancy": -0.5231047085946912,
    "medianReturn": -0.6547910059241353,
    "profitFactor": 0.04993460879727859,
    "maxDrawdown": 1.0017841261086233,
    "rugRate": 0.16326530612244897,
    "rugMeasurable": 49,
    "unclosablePct": 0.8873994638069705,
    "byMonth": {
      "2026-08": {
        "n": 32,
        "meanReturn": -0.5231047085946912
      }
    }
  },
  "verdict": "NO EDGE: expectancy -11.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
