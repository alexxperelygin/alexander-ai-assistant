# Backtest (2026-08-20T08:39:19Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 186,
    "horizon": "24h",
    "evaluable": 108,
    "winRate": 0.37962962962962965,
    "expectancy": -0.06693203271904724,
    "medianReturn": -0.025457248939403987,
    "profitFactor": 0.46473512730104666,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08333333333333333,
    "rugMeasurable": 168,
    "unclosablePct": 0.0967741935483871,
    "byMonth": {
      "2026-08": {
        "n": 108,
        "meanReturn": -0.06693203271904721
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
NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 186,
    "horizon": "6h",
    "evaluable": 145,
    "winRate": 0.35172413793103446,
    "expectancy": -0.0534262361714283,
    "medianReturn": -0.018349828646443744,
    "profitFactor": 0.48442959500169763,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04790419161676647,
    "rugMeasurable": 167,
    "unclosablePct": 0.10215053763440861,
    "byMonth": {
      "2026-08": {
        "n": 145,
        "meanReturn": -0.053426236171428325
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
  "verdict": "NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 5 с при лимите 600 с; код ssh 0._
