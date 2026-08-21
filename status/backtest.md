# Backtest (2026-08-21T08:39:14Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 193,
    "horizon": "24h",
    "evaluable": 110,
    "winRate": 0.4,
    "expectancy": -0.06159202359264259,
    "medianReturn": -0.025457248939403987,
    "profitFactor": 0.5001086265765962,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07954545454545454,
    "rugMeasurable": 176,
    "unclosablePct": 0.08808290155440414,
    "byMonth": {
      "2026-08": {
        "n": 110,
        "meanReturn": -0.061592023592642556
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
  "verdict": "NO EDGE: expectancy -6.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 8 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 193,
    "horizon": "6h",
    "evaluable": 151,
    "winRate": 0.3509933774834437,
    "expectancy": -0.05142960100780279,
    "medianReturn": -0.018139065984117297,
    "profitFactor": 0.4897260792561096,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.045714285714285714,
    "rugMeasurable": 175,
    "unclosablePct": 0.09326424870466321,
    "byMonth": {
      "2026-08": {
        "n": 151,
        "meanReturn": -0.05142960100780281
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
  "verdict": "NO EDGE: expectancy -5.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
