# Backtest (2026-08-27T08:38:44Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 222,
    "horizon": "24h",
    "evaluable": 119,
    "winRate": 0.42857142857142855,
    "expectancy": -0.05580400215611215,
    "medianReturn": -0.02247567835401232,
    "profitFactor": 0.5502417168691885,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08040201005025126,
    "rugMeasurable": 199,
    "unclosablePct": 0.1036036036036036,
    "byMonth": {
      "2026-08": {
        "n": 119,
        "meanReturn": -0.05580400215611212
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
  "verdict": "NO EDGE: expectancy -5.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 8 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 222,
    "horizon": "6h",
    "evaluable": 166,
    "winRate": 0.3674698795180723,
    "expectancy": -0.04483667143841916,
    "medianReturn": -0.01824444731528052,
    "profitFactor": 0.5362775315336685,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.045454545454545456,
    "rugMeasurable": 198,
    "unclosablePct": 0.10810810810810811,
    "byMonth": {
      "2026-08": {
        "n": 166,
        "meanReturn": -0.04483667143841918
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
  "verdict": "NO EDGE: expectancy -4.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 7 с при лимите 600 с; код ssh 0._
