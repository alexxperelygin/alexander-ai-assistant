# Backtest (2026-08-27T16:41:35Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 223,
    "horizon": "24h",
    "evaluable": 121,
    "winRate": 0.4214876033057851,
    "expectancy": -0.04588037238553647,
    "medianReturn": -0.022037280677103976,
    "profitFactor": 0.6242184554725855,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08,
    "rugMeasurable": 200,
    "unclosablePct": 0.1031390134529148,
    "byMonth": {
      "2026-08": {
        "n": 121,
        "meanReturn": -0.045880372385536446
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
  "verdict": "NO EDGE: expectancy -4.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 11 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 223,
    "horizon": "6h",
    "evaluable": 168,
    "winRate": 0.36904761904761907,
    "expectancy": -0.042515997273562624,
    "medianReturn": -0.01808127218318545,
    "profitFactor": 0.5553042701231088,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04522613065326633,
    "rugMeasurable": 199,
    "unclosablePct": 0.10762331838565023,
    "byMonth": {
      "2026-08": {
        "n": 168,
        "meanReturn": -0.042515997273562645
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
  "verdict": "NO EDGE: expectancy -4.3% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
