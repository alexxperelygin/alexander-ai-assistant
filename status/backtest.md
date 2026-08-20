# Backtest (2026-08-20T00:38:41Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 185,
    "horizon": "24h",
    "evaluable": 107,
    "winRate": 0.3925233644859813,
    "expectancy": -0.06724005244547741,
    "medianReturn": -0.025077242222725116,
    "profitFactor": 0.4659974320297622,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08333333333333333,
    "rugMeasurable": 168,
    "unclosablePct": 0.0918918918918919,
    "byMonth": {
      "2026-08": {
        "n": 107,
        "meanReturn": -0.0672400524454774
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

_Расчёт занял 12 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 185,
    "horizon": "6h",
    "evaluable": 145,
    "winRate": 0.3586206896551724,
    "expectancy": -0.053147877739308784,
    "medianReturn": -0.018139065984117297,
    "profitFactor": 0.48580298453251103,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04790419161676647,
    "rugMeasurable": 167,
    "unclosablePct": 0.0972972972972973,
    "byMonth": {
      "2026-08": {
        "n": 145,
        "meanReturn": -0.05314787773930881
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
