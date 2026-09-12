# Backtest (2026-09-12T00:38:29Z)

## Горизонт 24h
Running backtest: horizon=24h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -5.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 332,
    "horizon": "24h",
    "evaluable": 187,
    "winRate": 0.33689839572192515,
    "expectancy": -0.051996067195806815,
    "medianReturn": -0.02582252408900443,
    "profitFactor": 0.5163866901562764,
    "maxDrawdown": 1.0000017674860007,
    "rugRate": 0.07540983606557378,
    "rugMeasurable": 305,
    "unclosablePct": 0.08433734939759036,
    "byMonth": {
      "2026-08": {
        "n": 125,
        "meanReturn": -0.03999731969196851
      },
      "2026-09": {
        "n": 62,
        "meanReturn": -0.07618709038902917
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
  "verdict": "NO EDGE: expectancy -5.2% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 12 с при лимите 600 с; код ssh 0._

## Горизонт 6h
Running backtest: horizon=6h, dataMode=live, position=$50
Status: DONE
NO EDGE: expectancy -6.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают.
{
  "strategy": {
    "signals": 332,
    "horizon": "6h",
    "evaluable": 264,
    "winRate": 0.3181818181818182,
    "expectancy": -0.06104900635798514,
    "medianReturn": -0.017696677737363442,
    "profitFactor": 0.39103334723244637,
    "maxDrawdown": 1.0000000003832348,
    "rugRate": 0.05263157894736842,
    "rugMeasurable": 304,
    "unclosablePct": 0.08433734939759036,
    "byMonth": {
      "2026-08": {
        "n": 177,
        "meanReturn": -0.043455329139597446
      },
      "2026-09": {
        "n": 87,
        "meanReturn": -0.09684303931953257
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
  "verdict": "NO EDGE: expectancy -6.1% ≤ 0 после издержек. Сигналы в текущем виде не зарабатывают."
}
exit=0

_Расчёт занял 8 с при лимите 600 с; код ssh 0._
