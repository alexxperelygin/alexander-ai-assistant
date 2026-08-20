# Backtest (2026-08-20T16:39:20Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 187,
    "horizon": "24h",
    "evaluable": 108,
    "winRate": 0.3888888888888889,
    "expectancy": -0.06682521245482322,
    "medianReturn": -0.026488661068825192,
    "profitFactor": 0.4674963514663146,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08235294117647059,
    "rugMeasurable": 170,
    "unclosablePct": 0.09090909090909091,
    "byMonth": {
      "2026-08": {
        "n": 108,
        "meanReturn": -0.0668252124548232
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

_Расчёт занял 8 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 187,
    "horizon": "6h",
    "evaluable": 147,
    "winRate": 0.3469387755102041,
    "expectancy": -0.0533894522109798,
    "medianReturn": -0.01887812210989326,
    "profitFactor": 0.4811809262311991,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.047337278106508875,
    "rugMeasurable": 169,
    "unclosablePct": 0.0962566844919786,
    "byMonth": {
      "2026-08": {
        "n": 147,
        "meanReturn": -0.05338945221097983
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
