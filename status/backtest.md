# Backtest (2026-08-28T08:39:20Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 226,
    "horizon": "24h",
    "evaluable": 123,
    "winRate": 0.42276422764227645,
    "expectancy": -0.040053965488058,
    "medianReturn": -0.021520703035057376,
    "profitFactor": 0.6669148077419486,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07881773399014778,
    "rugMeasurable": 203,
    "unclosablePct": 0.10176991150442478,
    "byMonth": {
      "2026-08": {
        "n": 123,
        "meanReturn": -0.04005396548805797
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

_Расчёт занял 8 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 226,
    "horizon": "6h",
    "evaluable": 170,
    "winRate": 0.36470588235294116,
    "expectancy": -0.04232916234355323,
    "medianReturn": -0.017635916423215603,
    "profitFactor": 0.5527526046072567,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04455445544554455,
    "rugMeasurable": 202,
    "unclosablePct": 0.10619469026548672,
    "byMonth": {
      "2026-08": {
        "n": 170,
        "meanReturn": -0.04232916234355325
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
