# Backtest (2026-09-08T16:38:21Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -3.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 295,
    "horizon": "24h",
    "evaluable": 157,
    "winRate": 0.3885350318471338,
    "expectancy": -0.03934135372678901,
    "medianReturn": -0.018472832734825584,
    "profitFactor": 0.6249305583772468,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07806691449814127,
    "rugMeasurable": 269,
    "unclosablePct": 0.09152542372881356,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 32,
        "meanReturn": -0.03677898667530641
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
  "verdict": "NO EDGE: expectancy -3.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 295,
    "horizon": "6h",
    "evaluable": 228,
    "winRate": 0.3508771929824561,
    "expectancy": -0.05534015010582891,
    "medianReturn": -0.01588998452654644,
    "profitFactor": 0.4476554316014964,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.05223880597014925,
    "rugMeasurable": 268,
    "unclosablePct": 0.09152542372881356,
    "byMonth": {
      "2026-08": {
        "n": 177,
        "meanReturn": -0.043455329139597446
      },
      "2026-09": {
        "n": 51,
        "meanReturn": -0.09658746992980878
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

_Расчёт занял 8 с при лимите 600 с; код ssh 0._
