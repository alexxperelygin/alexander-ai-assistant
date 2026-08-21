# Backtest (2026-08-21T16:39:26Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 196,
    "horizon": "24h",
    "evaluable": 112,
    "winRate": 0.4107142857142857,
    "expectancy": -0.058374849909868375,
    "medianReturn": -0.024917353795160857,
    "profitFactor": 0.5176055709248932,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07865168539325842,
    "rugMeasurable": 178,
    "unclosablePct": 0.09183673469387756,
    "byMonth": {
      "2026-08": {
        "n": 112,
        "meanReturn": -0.05837484990986835
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
  "verdict": "NO EDGE: expectancy -5.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 196,
    "horizon": "6h",
    "evaluable": 153,
    "winRate": 0.35947712418300654,
    "expectancy": -0.049329247565146624,
    "medianReturn": -0.018139065984117297,
    "profitFactor": 0.5045823980355163,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04519774011299435,
    "rugMeasurable": 177,
    "unclosablePct": 0.09693877551020408,
    "byMonth": {
      "2026-08": {
        "n": 153,
        "meanReturn": -0.049329247565146644
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
  "verdict": "NO EDGE: expectancy -4.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
