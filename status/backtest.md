# Backtest (2026-08-26T08:39:30Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 215,
    "horizon": "24h",
    "evaluable": 117,
    "winRate": 0.4188034188034188,
    "expectancy": -0.05695656360815523,
    "medianReturn": -0.0247574653675966,
    "profitFactor": 0.5486676090226057,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08333333333333333,
    "rugMeasurable": 192,
    "unclosablePct": 0.10697674418604651,
    "byMonth": {
      "2026-08": {
        "n": 117,
        "meanReturn": -0.056956563608155195
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
  "verdict": "NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 9 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 215,
    "horizon": "6h",
    "evaluable": 160,
    "winRate": 0.3625,
    "expectancy": -0.045646377287300435,
    "medianReturn": -0.01824444731528052,
    "profitFactor": 0.5282024016038152,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.04712041884816754,
    "rugMeasurable": 191,
    "unclosablePct": 0.11162790697674418,
    "byMonth": {
      "2026-08": {
        "n": 160,
        "meanReturn": -0.045646377287300456
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
  "verdict": "NO EDGE: expectancy -4.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 6 с при лимите 600 с; код ssh 0._
