# Backtest (2026-08-19T12:41:21Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 180,
    "horizon": "24h",
    "evaluable": 105,
    "winRate": 0.4,
    "expectancy": -0.06742218883938637,
    "medianReturn": -0.025077242222725116,
    "profitFactor": 0.47177103514946755,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08536585365853659,
    "rugMeasurable": 164,
    "unclosablePct": 0.08888888888888889,
    "byMonth": {
      "2026-08": {
        "n": 105,
        "meanReturn": -0.06742218883938636
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
  "verdict": "NO EDGE: expectancy -6.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 8 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 180,
    "horizon": "6h",
    "evaluable": 141,
    "winRate": 0.3546099290780142,
    "expectancy": -0.06610465806893424,
    "medianReturn": -0.018349828646443744,
    "profitFactor": 0.3761530203410534,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.049079754601226995,
    "rugMeasurable": 163,
    "unclosablePct": 0.09444444444444444,
    "byMonth": {
      "2026-08": {
        "n": 141,
        "meanReturn": -0.06610465806893427
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
  "verdict": "NO EDGE: expectancy -6.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
