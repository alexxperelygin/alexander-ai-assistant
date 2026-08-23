# Backtest (2026-08-23T00:39:02Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 200,
    "horizon": "24h",
    "evaluable": 114,
    "winRate": 0.41228070175438597,
    "expectancy": -0.05717511232180997,
    "medianReturn": -0.024917353795160857,
    "profitFactor": 0.5264627334805116,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07734806629834254,
    "rugMeasurable": 181,
    "unclosablePct": 0.095,
    "byMonth": {
      "2026-08": {
        "n": 114,
        "meanReturn": -0.05717511232180993
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
  "verdict": "NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 200,
    "horizon": "6h",
    "evaluable": 155,
    "winRate": 0.36129032258064514,
    "expectancy": -0.04696185952150137,
    "medianReturn": -0.018139065984117297,
    "profitFactor": 0.5246982431666316,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.044444444444444446,
    "rugMeasurable": 180,
    "unclosablePct": 0.1,
    "byMonth": {
      "2026-08": {
        "n": 155,
        "meanReturn": -0.04696185952150139
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
  "verdict": "NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
