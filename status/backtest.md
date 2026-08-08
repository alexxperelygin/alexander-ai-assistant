# Backtest (2026-08-08T20:43:14Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -4.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 99,
    "horizon": "24h",
    "evaluable": 41,
    "winRate": 0.5609756097560976,
    "expectancy": -0.04843206042696519,
    "medianReturn": 0.03848740902428749,
    "profitFactor": 0.6696082653002797,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.10843373493975904,
    "rugMeasurable": 83,
    "unclosablePct": 0.16161616161616163,
    "byMonth": {
      "2026-08": {
        "n": 41,
        "meanReturn": -0.04843206042696519
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
NO EDGE: expectancy -10.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 99,
    "horizon": "6h",
    "evaluable": 68,
    "winRate": 0.4411764705882353,
    "expectancy": -0.10772635087704394,
    "medianReturn": -0.013172082051649325,
    "profitFactor": 0.34934780419354405,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.07317073170731707,
    "rugMeasurable": 82,
    "unclosablePct": 0.1717171717171717,
    "byMonth": {
      "2026-08": {
        "n": 68,
        "meanReturn": -0.10772635087704398
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
  "verdict": "NO EDGE: expectancy -10.8% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
