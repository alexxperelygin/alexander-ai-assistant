# Backtest (2026-09-14T08:38:55Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 360,
    "horizon": "24h",
    "evaluable": 209,
    "winRate": 0.35406698564593303,
    "expectancy": -0.04032089713264013,
    "medianReturn": -0.024575935091086576,
    "profitFactor": 0.5951238907278774,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.06927710843373494,
    "rugMeasurable": 332,
    "unclosablePct": 0.08055555555555556,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 84,
        "meanReturn": -0.04080241118125851
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

_Расчёт занял 21 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 360,
    "horizon": "6h",
    "evaluable": 289,
    "winRate": 0.3217993079584775,
    "expectancy": -0.05476418579109792,
    "medianReturn": -0.017187913003029354,
    "profitFactor": 0.41588916992304703,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04833836858006042,
    "rugMeasurable": 331,
    "unclosablePct": 0.08055555555555556,
    "byMonth": {
      "2026-08": {
        "n": 177,
        "meanReturn": -0.043455329139597446
      },
      "2026-09": {
        "n": 112,
        "meanReturn": -0.07263621817784426
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
  "verdict": "NO EDGE: expectancy -5.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 9 с при лимите 600 с; код ssh 0._
