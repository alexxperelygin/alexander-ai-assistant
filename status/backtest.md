# Backtest (2026-08-11T20:38:51Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -7.4% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 123,
    "horizon": "24h",
    "evaluable": 63,
    "winRate": 0.4444444444444444,
    "expectancy": -0.07434356898093285,
    "medianReturn": -0.017675409348408055,
    "profitFactor": 0.490138638427365,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.10185185185185185,
    "rugMeasurable": 108,
    "unclosablePct": 0.12195121951219512,
    "byMonth": {
      "2026-08": {
        "n": 63,
        "meanReturn": -0.07434356898093285
      }
    }
  },
  "baseline": {
    "signals": 373,
    "horizon": "24h",
    "evaluable": 9,
    "winRate": 0.1111111111111111,
    "expectancy": -0.07199573852859983,
    "medianReturn": -0.021106386888578132,
    "profitFactor": 0.7036355752679927,
    "maxDrawdown": 1.000956402111226,
    "rugRate": 0.16326530612244897,
    "rugMeasurable": 49,
    "unclosablePct": 0.9195710455764075,
    "byMonth": {
      "2026-08": {
        "n": 9,
        "meanReturn": -0.07199573852859983
      }
    }
  },
  "verdict": "NO EDGE: expectancy -7.4% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -7.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 123,
    "horizon": "6h",
    "evaluable": 93,
    "winRate": 0.40860215053763443,
    "expectancy": -0.07801393662134735,
    "medianReturn": -0.014038332845663581,
    "profitFactor": 0.38456292313855034,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.056074766355140186,
    "rugMeasurable": 107,
    "unclosablePct": 0.13008130081300814,
    "byMonth": {
      "2026-08": {
        "n": 93,
        "meanReturn": -0.07801393662134738
      }
    }
  },
  "baseline": {
    "signals": 373,
    "horizon": "6h",
    "evaluable": 21,
    "winRate": 0.047619047619047616,
    "expectancy": -0.30953721380437765,
    "medianReturn": -0.05283091323903544,
    "profitFactor": 0.1192156918704334,
    "maxDrawdown": 1.0017841431805043,
    "rugRate": 0.16326530612244897,
    "rugMeasurable": 49,
    "unclosablePct": 0.9195710455764075,
    "byMonth": {
      "2026-08": {
        "n": 21,
        "meanReturn": -0.30953721380437765
      }
    }
  },
  "verdict": "NO EDGE: expectancy -7.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
