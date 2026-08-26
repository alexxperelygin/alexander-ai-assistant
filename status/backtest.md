# Backtest (2026-08-26T16:53:33Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 216,
    "horizon": "24h",
    "evaluable": 117,
    "winRate": 0.4188034188034188,
    "expectancy": -0.05695656360815523,
    "medianReturn": -0.0247574653675966,
    "profitFactor": 0.5486676090226057,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.08290155440414508,
    "rugMeasurable": 193,
    "unclosablePct": 0.10648148148148148,
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

_Расчёт занял 16 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 216,
    "horizon": "6h",
    "evaluable": 162,
    "winRate": 0.35802469135802467,
    "expectancy": -0.048480465594529294,
    "medianReturn": -0.0186139753781685,
    "profitFactor": 0.5100662021430955,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.046875,
    "rugMeasurable": 192,
    "unclosablePct": 0.1111111111111111,
    "byMonth": {
      "2026-08": {
        "n": 162,
        "meanReturn": -0.048480465594529315
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
  "verdict": "NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 7 с при лимите 600 с; код ssh 0._
