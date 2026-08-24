# Backtest (2026-08-24T00:38:39Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 203,
    "horizon": "24h",
    "evaluable": 116,
    "winRate": 0.4224137931034483,
    "expectancy": -0.048928781019595684,
    "medianReturn": -0.02361657186080446,
    "profitFactor": 0.5876512613154234,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07608695652173914,
    "rugMeasurable": 184,
    "unclosablePct": 0.09359605911330049,
    "byMonth": {
      "2026-08": {
        "n": 116,
        "meanReturn": -0.048928781019595656
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
  "verdict": "NO EDGE: expectancy -4.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 203,
    "horizon": "6h",
    "evaluable": 157,
    "winRate": 0.35668789808917195,
    "expectancy": -0.04682800190314002,
    "medianReturn": -0.018349828646443744,
    "profitFactor": 0.5222121635137646,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04371584699453552,
    "rugMeasurable": 183,
    "unclosablePct": 0.09852216748768473,
    "byMonth": {
      "2026-08": {
        "n": 157,
        "meanReturn": -0.04682800190314005
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
