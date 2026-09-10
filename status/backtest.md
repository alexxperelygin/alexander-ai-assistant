# Backtest (2026-09-10T16:40:15Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 318,
    "horizon": "24h",
    "evaluable": 178,
    "winRate": 0.34269662921348315,
    "expectancy": -0.05242401316268591,
    "medianReturn": -0.024917353795160857,
    "profitFactor": 0.5260120149590952,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07903780068728522,
    "rugMeasurable": 291,
    "unclosablePct": 0.0880503144654088,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 53,
        "meanReturn": -0.08173225248041553
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
  "verdict": "NO EDGE: expectancy -5.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 16 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 318,
    "horizon": "6h",
    "evaluable": 251,
    "winRate": 0.3187250996015936,
    "expectancy": -0.06300083886307532,
    "medianReturn": -0.018139065984117297,
    "profitFactor": 0.3927171752982773,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.05517241379310345,
    "rugMeasurable": 290,
    "unclosablePct": 0.0880503144654088,
    "byMonth": {
      "2026-08": {
        "n": 177,
        "meanReturn": -0.043455329139597446
      },
      "2026-09": {
        "n": 74,
        "meanReturn": -0.1097515850935562
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
  "verdict": "NO EDGE: expectancy -6.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 9 с при лимите 600 с; код ssh 0._
