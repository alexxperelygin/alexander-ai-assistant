# Backtest (2026-08-28T00:38:54Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 224,
    "horizon": "24h",
    "evaluable": 123,
    "winRate": 0.42276422764227645,
    "expectancy": -0.039986208649951366,
    "medianReturn": -0.021520703035057376,
    "profitFactor": 0.6672907992833281,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07960199004975124,
    "rugMeasurable": 201,
    "unclosablePct": 0.10267857142857142,
    "byMonth": {
      "2026-08": {
        "n": 123,
        "meanReturn": -0.03998620864995134
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
  "verdict": "NO EDGE: expectancy -4.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 13 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 224,
    "horizon": "6h",
    "evaluable": 168,
    "winRate": 0.36904761904761907,
    "expectancy": -0.042669576935562406,
    "medianReturn": -0.01808127218318545,
    "profitFactor": 0.5536979048896228,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.045,
    "rugMeasurable": 200,
    "unclosablePct": 0.10714285714285714,
    "byMonth": {
      "2026-08": {
        "n": 168,
        "meanReturn": -0.04266957693556243
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
  "verdict": "NO EDGE: expectancy -4.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 7 с при лимите 600 с; код ssh 0._
