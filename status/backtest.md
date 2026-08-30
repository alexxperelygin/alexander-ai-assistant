# Backtest (2026-08-30T00:38:18Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 230,
    "horizon": "24h",
    "evaluable": 125,
    "winRate": 0.416,
    "expectancy": -0.039997319691968534,
    "medianReturn": -0.022037280677103976,
    "profitFactor": 0.6636382277281065,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07729468599033816,
    "rugMeasurable": 207,
    "unclosablePct": 0.1,
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

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 230,
    "horizon": "6h",
    "evaluable": 172,
    "winRate": 0.36046511627906974,
    "expectancy": -0.04224338578022408,
    "medianReturn": -0.01808127218318545,
    "profitFactor": 0.5503614154856281,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.043689320388349516,
    "rugMeasurable": 206,
    "unclosablePct": 0.10434782608695652,
    "byMonth": {
      "2026-08": {
        "n": 172,
        "meanReturn": -0.042243385780224095
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
  "verdict": "NO EDGE: expectancy -4.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
