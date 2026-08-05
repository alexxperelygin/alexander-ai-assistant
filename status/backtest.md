# Backtest (2026-08-05T12:40:54Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: NO_DATA
NO_DATA: сигналов 56, но измеримых исходов на горизонте 24h только 17 (< 20). Выводов о преимуществе сделать нельзя.
{
  "strategy": {
    "signals": 56,
    "horizon": "24h",
    "evaluable": 17,
    "winRate": 0.23529411764705882,
    "expectancy": -0.14997836285929905,
    "medianReturn": -0.08897061136006046,
    "profitFactor": 0.2862371612525636,
    "maxDrawdown": 1.0000004634340267,
    "rugRate": 0.07142857142857142,
    "unclosablePct": 0.26785714285714285,
    "byMonth": {
      "2026-08": {
        "n": 17,
        "meanReturn": -0.14997836285929905
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
  "verdict": "NO_DATA: сигналов 56, но измеримых исходов на горизонте 24h только 17 (< 20). Выводов о преимуществе сделать нельзя."
}

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -17.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 56,
    "horizon": "6h",
    "evaluable": 26,
    "winRate": 0.2692307692307692,
    "expectancy": -0.17487970761156474,
    "medianReturn": -0.03755991680578746,
    "profitFactor": 0.1822531682811431,
    "maxDrawdown": 0.9999996095951631,
    "rugRate": 0.07142857142857142,
    "unclosablePct": 0.26785714285714285,
    "byMonth": {
      "2026-08": {
        "n": 26,
        "meanReturn": -0.17487970761156474
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
  "verdict": "NO EDGE: expectancy -17.5% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
