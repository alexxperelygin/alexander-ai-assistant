# Backtest (2026-08-09T04:40:30Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 100,
    "horizon": "24h",
    "evaluable": 45,
    "winRate": 0.5333333333333333,
    "expectancy": -0.047595610483475666,
    "medianReturn": 0.015859458454444475,
    "profitFactor": 0.656796662848791,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.10588235294117647,
    "rugMeasurable": 85,
    "unclosablePct": 0.15,
    "byMonth": {
      "2026-08": {
        "n": 45,
        "meanReturn": -0.047595610483475666
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
  "verdict": "NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -10.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 100,
    "horizon": "6h",
    "evaluable": 71,
    "winRate": 0.43661971830985913,
    "expectancy": -0.10031029746317184,
    "medianReturn": -0.013833495377909455,
    "profitFactor": 0.3672880986522985,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.07142857142857142,
    "rugMeasurable": 84,
    "unclosablePct": 0.16,
    "byMonth": {
      "2026-08": {
        "n": 71,
        "meanReturn": -0.10031029746317188
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
  "verdict": "NO EDGE: expectancy -10.0% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
