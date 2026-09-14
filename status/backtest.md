# Backtest (2026-09-14T00:38:44Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 357,
    "horizon": "24h",
    "evaluable": 207,
    "winRate": 0.3526570048309179,
    "expectancy": -0.04324251805877399,
    "medianReturn": -0.024575935091086576,
    "profitFactor": 0.5687812094936685,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.06990881458966565,
    "rugMeasurable": 329,
    "unclosablePct": 0.08123249299719888,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 82,
        "meanReturn": -0.04818946678866033
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
  "verdict": "NO EDGE: expectancy -4.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 16 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 357,
    "horizon": "6h",
    "evaluable": 288,
    "winRate": 0.3229166666666667,
    "expectancy": -0.055195909046214714,
    "medianReturn": -0.01721813373360348,
    "profitFactor": 0.4136327918612599,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04878048780487805,
    "rugMeasurable": 328,
    "unclosablePct": 0.08123249299719888,
    "byMonth": {
      "2026-08": {
        "n": 177,
        "meanReturn": -0.043455329139597446
      },
      "2026-09": {
        "n": 111,
        "meanReturn": -0.07391737430271257
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
