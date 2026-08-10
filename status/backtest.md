# Backtest (2026-08-10T00:38:24Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -2.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 112,
    "horizon": "24h",
    "evaluable": 51,
    "winRate": 0.5882352941176471,
    "expectancy": -0.021603561796709466,
    "medianReturn": 0.03738447767068531,
    "profitFactor": 0.8214160567098543,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.09278350515463918,
    "rugMeasurable": 97,
    "unclosablePct": 0.13392857142857142,
    "byMonth": {
      "2026-08": {
        "n": 51,
        "meanReturn": -0.021603561796709466
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
  "verdict": "NO EDGE: expectancy -2.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -8.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 112,
    "horizon": "6h",
    "evaluable": 82,
    "winRate": 0.4268292682926829,
    "expectancy": -0.08689022175932294,
    "medianReturn": -0.011524913942797033,
    "profitFactor": 0.378320803757071,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.0625,
    "rugMeasurable": 96,
    "unclosablePct": 0.14285714285714285,
    "byMonth": {
      "2026-08": {
        "n": 82,
        "meanReturn": -0.08689022175932296
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
  "verdict": "NO EDGE: expectancy -8.7% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
