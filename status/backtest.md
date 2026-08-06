# Backtest (2026-08-06T00:39:23Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 70,
    "horizon": "24h",
    "evaluable": 20,
    "winRate": 0.4,
    "expectancy": -0.05092310760880446,
    "medianReturn": -0.015910843385090134,
    "profitFactor": 0.7020861796901018,
    "maxDrawdown": 1.0000013672893198,
    "rugRate": 0.1,
    "unclosablePct": 0.22857142857142856,
    "byMonth": {
      "2026-08": {
        "n": 20,
        "meanReturn": -0.05092310760880446
      }
    }
  },
  "baseline": {
    "signals": 1997,
    "horizon": "24h",
    "evaluable": 0,
    "winRate": null,
    "expectancy": null,
    "medianReturn": null,
    "profitFactor": null,
    "maxDrawdown": null,
    "rugRate": 0,
    "unclosablePct": 1,
    "byMonth": {}
  },
  "verdict": "NO EDGE: expectancy -5.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -21.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 70,
    "horizon": "6h",
    "evaluable": 38,
    "winRate": 0.34210526315789475,
    "expectancy": -0.21622555846976083,
    "medianReturn": -0.03357637653442064,
    "profitFactor": 0.20162514312904065,
    "maxDrawdown": 1.0000000003831415,
    "rugRate": 0.1,
    "unclosablePct": 0.22857142857142856,
    "byMonth": {
      "2026-08": {
        "n": 38,
        "meanReturn": -0.21622555846976077
      }
    }
  },
  "baseline": {
    "signals": 1997,
    "horizon": "6h",
    "evaluable": 0,
    "winRate": null,
    "expectancy": null,
    "medianReturn": null,
    "profitFactor": null,
    "maxDrawdown": null,
    "rugRate": 0,
    "unclosablePct": 1,
    "byMonth": {}
  },
  "verdict": "NO EDGE: expectancy -21.6% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
