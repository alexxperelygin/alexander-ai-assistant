# Backtest (2026-08-30T08:38:20Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 232,
    "horizon": "24h",
    "evaluable": 125,
    "winRate": 0.416,
    "expectancy": -0.039997319691968534,
    "medianReturn": -0.022037280677103976,
    "profitFactor": 0.6636382277281065,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07655502392344497,
    "rugMeasurable": 209,
    "unclosablePct": 0.09913793103448276,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
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

_Расчёт занял 9 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -2.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 232,
    "horizon": "6h",
    "evaluable": 173,
    "winRate": 0.36416184971098264,
    "expectancy": -0.0288194054905525,
    "medianReturn": -0.0180234783822536,
    "profitFactor": 0.6914638047987424,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04326923076923077,
    "rugMeasurable": 208,
    "unclosablePct": 0.10344827586206896,
    "byMonth": {
      "2026-08": {
        "n": 173,
        "meanReturn": -0.02881940549055252
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
  "verdict": "NO EDGE: expectancy -2.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 7 с при лимите 600 с; код ssh 0._
