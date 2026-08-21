# Backtest (2026-08-21T00:39:14Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 190,
    "horizon": "24h",
    "evaluable": 109,
    "winRate": 0.3944954128440367,
    "expectancy": -0.06544941643395369,
    "medianReturn": -0.025837255656082858,
    "profitFactor": 0.4736304465305496,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08092485549132948,
    "rugMeasurable": 173,
    "unclosablePct": 0.08947368421052632,
    "byMonth": {
      "2026-08": {
        "n": 109,
        "meanReturn": -0.06544941643395366
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
  "verdict": "NO EDGE: expectancy -6.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 190,
    "horizon": "6h",
    "evaluable": 148,
    "winRate": 0.35135135135135137,
    "expectancy": -0.053394369927481866,
    "medianReturn": -0.0186139753781685,
    "profitFactor": 0.48010634524766466,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.046511627906976744,
    "rugMeasurable": 172,
    "unclosablePct": 0.09473684210526316,
    "byMonth": {
      "2026-08": {
        "n": 148,
        "meanReturn": -0.053394369927481894
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
