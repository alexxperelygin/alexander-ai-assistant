# Backtest (2026-08-17T12:52:44Z)

## Горизонт 24h
(ошибка или таймаут 5 мин)

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 166,
    "horizon": "6h",
    "evaluable": 129,
    "winRate": 0.3643410852713178,
    "expectancy": -0.0693859527061097,
    "medianReturn": -0.0180234783822536,
    "profitFactor": 0.37532428309883714,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.053691275167785234,
    "rugMeasurable": 149,
    "unclosablePct": 0.10240963855421686,
    "byMonth": {
      "2026-08": {
        "n": 129,
        "meanReturn": -0.06938595270610973
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
  "verdict": "NO EDGE: expectancy -6.9% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
