# Backtest (2026-09-16T00:38:09Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 371,
    "horizon": "24h",
    "evaluable": 221,
    "winRate": 0.334841628959276,
    "expectancy": -0.04791085121434944,
    "medianReturn": -0.02582252408900443,
    "profitFactor": 0.5306769885920469,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.06705539358600583,
    "rugMeasurable": 343,
    "unclosablePct": 0.07816711590296496,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 96,
        "meanReturn": -0.058214928717449516
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
  "verdict": "NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 17 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 371,
    "horizon": "6h",
    "evaluable": 301,
    "winRate": 0.31561461794019935,
    "expectancy": -0.05298947367081367,
    "medianReturn": -0.017695933612167813,
    "profitFactor": 0.4231624037454273,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04678362573099415,
    "rugMeasurable": 342,
    "unclosablePct": 0.07816711590296496,
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

_Расчёт занял 7 с при лимите 600 с; код ssh 0._
