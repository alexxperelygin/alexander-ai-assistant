# Backtest (2026-08-22T00:38:24Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 196,
    "horizon": "24h",
    "evaluable": 113,
    "winRate": 0.415929203539823,
    "expectancy": -0.05210219542270172,
    "medianReturn": -0.0247574653675966,
    "profitFactor": 0.5655968647299383,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07865168539325842,
    "rugMeasurable": 178,
    "unclosablePct": 0.09183673469387756,
    "byMonth": {
      "2026-08": {
        "n": 113,
        "meanReturn": -0.05210219542270168
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

_Расчёт занял 10 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 196,
    "horizon": "6h",
    "evaluable": 154,
    "winRate": 0.36363636363636365,
    "expectancy": -0.04674539396817191,
    "medianReturn": -0.01808127218318545,
    "profitFactor": 0.5274638309053185,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04519774011299435,
    "rugMeasurable": 177,
    "unclosablePct": 0.09693877551020408,
    "byMonth": {
      "2026-08": {
        "n": 154,
        "meanReturn": -0.04674539396817193
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
  "verdict": "NO EDGE: expectancy -4.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
