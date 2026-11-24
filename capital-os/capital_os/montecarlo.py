"""Монте-Карло: распределение чистого капитала через N лет по четырём стратегиям.

Модель намеренно проста (decision.10). Каждый параметр лежит в data/model.json
и является допущением. Результат читается как порядок величины и как ответ на
вопрос «какой рычаг важнее», а не как прогноз.
"""
import copy
import json
import math
import random

from . import ROOT

STRATEGIES = {
    "trading": "Только торговля собственным и проп-счётом",
    "info": "Только инфобизнес (подписка, курсы, услуги)",
    "fund": "Кэш-двигатель + фонд под управлением",
    "equity": "Кэш-двигатель + серия продуктовых компаний с долей",
    "rollup": "Кэш-двигатель + скупка сервисных фирм на деньги фондов (доля 25%)",
}
THRESHOLDS = (0, 10e6, 100e6, 1e9)


def load_model(path=None) -> dict:
    return json.loads((path or ROOT / "data" / "model.json").read_text(encoding="utf-8"))


def _ln(rng, median, sigma):
    return median * math.exp(rng.gauss(0, sigma))


class _Engine:
    """Кэш-двигатель инфобизнеса: годовая прибыль с ростом, потолком и редкими ударами."""

    def __init__(self, rng, c, share=1.0):
        self.rng, self.c, self.share = rng, c, share
        self.profit = _ln(rng, c["profit_y1_median"], c["profit_y1_sigma"])

    def year(self) -> float:
        out = self.profit * self.share
        g = _ln(self.rng, self.c["growth_median"], self.c["growth_sigma"])
        if self.rng.random() < self.c["p_shock"]:
            g *= self.c["shock_mult"]
        self.profit = min(self.profit * g, self.c["profit_cap_usd"])
        return out

    def value(self) -> float:
        return self.profit * self.share * self.c["exit_multiple"]


def _path(strategy: str, m: dict, years: int, rng: random.Random) -> float:
    com = m["common"]
    cash, debt, asset = com["start_cash_usd"], com["debt_usd"], 0.0

    def settle(income):
        nonlocal cash, debt
        cash += income
        debt *= 1 + com["debt_rate"]
        pay = min(debt, max(0.0, cash) * com["debt_paydown_share"])
        cash -= pay
        debt -= pay

    if strategy == "trading":
        c = m["trading"]
        skilled = rng.random() < c["p_skill"]
        mu, sg = (c["skilled_mu"], c["skilled_sigma"]) if skilled else (c["unskilled_mu"], c["unskilled_sigma"])
        capital, cash = cash, 0.0
        for _ in range(years):
            r = math.exp(rng.gauss(mu - sg * sg / 2, sg)) - 1
            prop = c["prop_funded_cap_usd"] * c["prop_profit_split"] * max(r, 0) if skilled else 0.0
            capital = max(0.0, capital * (1 + r))
            settle(prop)
        asset = capital

    elif strategy == "info":
        eng = _Engine(rng, m["info"])
        for _ in range(years):
            settle(eng.year())
        asset = eng.value()

    elif strategy == "fund":
        c = m["fund"]
        eng = _Engine(rng, m["info"], m["equity"]["engine_share"])
        aum, clock, fee, age, closed = 0.0, 0, 0.0, 0, False
        for _ in range(years):
            income = eng.year()
            if closed:
                pass                                      # после закрытия фонда второй не собрать (trust.4)
            elif aum <= 0:
                clock += 1
                if clock >= c["years_to_track"]:
                    clock = 0
                    if rng.random() < c["p_launch"]:
                        aum, age = _ln(rng, c["aum0_median"], c["aum0_sigma"]), 0
            elif rng.random() < c["p_terminal"]:
                aum, fee, closed = 0.0, 0.0, True
            else:
                ret = rng.gauss(c["ret_mu"], c["ret_sigma"])
                gross = aum * (c["mgmt_fee"] + c["perf_fee"] * max(ret, 0.0))
                fee = gross * (1 - c["cost_share"]) * c["gp_share"]
                income += fee
                med = 1 + c["aum_growth_boost"] * c["aum_growth_decay"] ** age
                aum *= (1 + ret) * _ln(rng, med, c["aum_growth_sigma"])
                age += 1
                if ret < c["drawdown_trigger"]:
                    aum *= c["drawdown_aum_mult"]
            settle(income)
        asset = eng.value() + (fee * c["gp_value_multiple"] if aum > 0 else 0.0)

    elif strategy in ("equity", "rollup"):
        c = m[strategy]                                   # одна механика, разные параметры
        eng = _Engine(rng, m["info"], c["engine_share"])
        arr, own, age, clock, steps = 0.0, 0.0, 0, 0, 0
        for _ in range(years):
            income = eng.year()
            if arr <= 0:                                  # попытка найти продукт
                if cash + income >= c["burn_per_year"]:
                    income -= c["burn_per_year"]
                    clock += 1
                    if clock >= c["years_to_verdict"]:
                        clock = 0
                        if rng.random() < c["p_pmf"]:
                            arr, own, age, steps = _ln(rng, c["arr0_median"], c["arr0_sigma"]), c["ownership0"], 0, 0
            else:                                         # компания растёт
                if rng.random() < c["p_die"]:
                    arr = 0.0
                else:
                    med = 1 + c["growth_boost"] * c["growth_decay"] ** age
                    arr *= _ln(rng, med, c["growth_sigma"])
                    age += 1
                    while steps < len(c["dilution_steps_arr"]) and arr >= c["dilution_steps_arr"][steps]:
                        own *= c["dilution_mult"]
                        steps += 1
            settle(income)
        asset = eng.value() + (own * arr * _ln(rng, c["multiple_median"], c["multiple_sigma"]) if arr > 0 else 0.0)
    else:
        raise ValueError(strategy)

    return cash + asset - debt


def simulate(strategy: str, model: dict, years: int = 10, n: int = 50_000, seed: int = 7) -> dict:
    rng = random.Random(seed)
    xs = sorted(_path(strategy, model, years, rng) for _ in range(n))
    q = lambda p: xs[min(n - 1, int(p * n))]
    return {
        "strategy": strategy, "years": years, "n": n,
        "p_ge": {int(t): sum(x >= t for x in xs) / n for t in THRESHOLDS},
        "p10": q(0.10), "median": q(0.50), "p90": q(0.90), "p99": q(0.99), "max": xs[-1],
    }


def run_all(model: dict, years=(10, 15), n: int = 50_000, seed: int = 7) -> list[dict]:
    return [simulate(s, model, y, n, seed) for y in years for s in STRATEGIES]


SENSITIVITY = [("equity", "p_pmf"), ("equity", "growth_boost"), ("equity", "ownership0"),
               ("equity", "p_die"), ("equity", "arr0_median"), ("equity", "years_to_verdict"),
               ("info", "profit_y1_median"), ("common", "debt_usd")]


def sensitivity(model: dict, years: int = 15, n: int = 50_000, seed: int = 7) -> list[dict]:
    """Каждый параметр по очереди ×0,5 и ×1,5 — как меняются вероятности для стратегии equity."""
    rows = []
    for section, key in SENSITIVITY:
        row = {"param": f"{section}.{key}", "base": model[section][key]}
        for label, mult in (("low", 0.5), ("high", 1.5)):
            m = copy.deepcopy(model)
            v = m[section][key] * mult
            m[section][key] = max(1, round(v)) if key == "years_to_verdict" else v
            r = simulate("equity", m, years, n, seed)
            row[label] = {"p_1b": r["p_ge"][int(1e9)], "p_100m": r["p_ge"][int(100e6)], "p_debt_free": r["p_ge"][0]}
        rows.append(row)
    return rows
