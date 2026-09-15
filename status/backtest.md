# Backtest (2026-09-15T16:40:46Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 370,
    "horizon": "24h",
    "evaluable": 220,
    "winRate": 0.33636363636363636,
    "expectancy": -0.04713143851400718,
    "medianReturn": -0.025449883155864772,
    "profitFactor": 0.5358879755911607,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.06725146198830409,
    "rugMeasurable": 342,
    "unclosablePct": 0.07837837837837838,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 95,
        "meanReturn": -0.056518436964058
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
  "verdict": "NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 16 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 370,
    "horizon": "6h",
    "evaluable": 301,
    "winRate": 0.31561461794019935,
    "expectancy": -0.05298947367081367,
    "medianReturn": -0.017695933612167813,
    "profitFactor": 0.4231624037454273,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.0469208211143695,
    "rugMeasurable": 341,
    "unclosablePct": 0.07837837837837838,
    "byMonth": {
      "2026-08": {
        "n": 177,
        "meanReturn": -0.043455329139597446
      },
      "2026-09": {
        "n": 124,
        "meanReturn": -0.06659869610650136
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

_Расчёт занял 11 с при лимите 600 с; код ssh 0._
