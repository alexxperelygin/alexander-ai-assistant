# Backtest (2026-08-27T00:38:45Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 220,
    "horizon": "24h",
    "evaluable": 118,
    "winRate": 0.4152542372881356,
    "expectancy": -0.056510370328063594,
    "medianReturn": -0.02361657186080446,
    "profitFactor": 0.548507653578578,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08121827411167512,
    "rugMeasurable": 197,
    "unclosablePct": 0.10454545454545454,
    "byMonth": {
      "2026-08": {
        "n": 118,
        "meanReturn": -0.05651037032806356
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
NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 220,
    "horizon": "6h",
    "evaluable": 163,
    "winRate": 0.3619631901840491,
    "expectancy": -0.048171442910392874,
    "medianReturn": -0.018349828646443744,
    "profitFactor": 0.5101841175886049,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04591836734693878,
    "rugMeasurable": 196,
    "unclosablePct": 0.10909090909090909,
    "byMonth": {
      "2026-08": {
        "n": 163,
        "meanReturn": -0.048171442910392895
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
  "verdict": "NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
