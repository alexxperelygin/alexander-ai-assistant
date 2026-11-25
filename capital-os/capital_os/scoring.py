"""Ранжирование возможностей формулой (decision.2) и распределение ресурсов.

Вероятность успеха — оценка, стянутая к базовой частоте референсного класса
(statistics.9, decision.3). Суждение человека или модели допускается только
во входах; порядок определяет формула.
"""
import json
from dataclasses import dataclass, field

from . import ROOT

SAFE_KINDS = {"cash", "liability"}          # кэш-двигатель и долг
OPTION_KINDS = {"equity", "trading", "fund"}  # варианты с хвостом


@dataclass
class Scored:
    id: str
    name: str
    kind: str
    p: float                 # вероятность успеха после стягивания
    risk_mult: float         # (1 − юр. риск) × (1 − репутационный риск)
    ev_usd: float            # ожидаемая ценность за 3 года за вычетом затрат
    ev_per_month: float      # скорость: ожидаемая ценность на месяц до сигнала
    roi: float               # ожидаемая ценность на доллар затрат
    p_billion: float         # p × вероятность хвоста ≥ $1 млрд × риск
    raw: dict = field(repr=False, default_factory=dict)


def load_opportunities(path=None, include_inactive: bool = False) -> list[dict]:
    items = json.loads((path or ROOT / "data" / "opportunities.json").read_text(encoding="utf-8"))["items"]
    return [o for o in items if include_inactive or o.get("active", True)]


def shrink(p_est: float, base_rate: float, weight: float) -> float:
    return base_rate + weight * (p_est - base_rate)


def score(o: dict) -> Scored:
    # access — вероятность, что вход вообще открыт: капитал, лицензия, юрисдикция, партнёр.
    p = shrink(o["p_est"], o["base_rate"], o.get("evidence_weight", 0.3)) * o.get("access", 1.0)
    risk = (1 - o["legal_risk"]) * (1 - o["reputation_risk"])
    ev = p * risk * o["value_if_success_usd"] * o["ownership"] - o["cost_usd"]
    return Scored(
        id=o["id"], name=o["name"], kind=o["kind"], p=p, risk_mult=risk, ev_usd=ev,
        ev_per_month=ev / o["months_to_signal"],
        roi=ev / o["cost_usd"] if o["cost_usd"] else float("inf"),
        p_billion=p * risk * o.get("p_tail_1b", 0.0), raw=o,
    )


def rank(items: list[dict]) -> list[Scored]:
    return sorted((score(o) for o in items), key=lambda s: s.ev_per_month, reverse=True)


def allocate(scored: list[Scored], cfg: dict) -> list[dict]:
    """Штанга (risk.8): safe_share ресурсов — в кэш и долг, остальное — в варианты.

    Внутри корзины — не больше max_items_per_bucket позиций (operations.5),
    доли пропорциональны скорости ожидаемой ценности; для вариантов с хвостом
    половина веса отдаётся вероятности миллиарда, потому что цель задана ей.
    """
    hours, budget = cfg["owner_hours_per_week"], cfg["monthly_budget_usd"]
    out = []
    for bucket, kinds, share in (("кэш и долг", SAFE_KINDS, cfg["safe_share"]),
                                 ("варианты с хвостом", OPTION_KINDS, 1 - cfg["safe_share"])):
        pool = [s for s in scored if s.kind in kinds and s.ev_usd > 0]
        if kinds is OPTION_KINDS and pool:
            top_ev = max(s.ev_per_month for s in pool)
            top_pb = max(s.p_billion for s in pool) or 1.0
            weight = {s.id: 0.5 * s.ev_per_month / top_ev + 0.5 * s.p_billion / top_pb for s in pool}
        else:
            weight = {s.id: s.ev_per_month for s in pool}
        pool = sorted(pool, key=lambda s: weight[s.id], reverse=True)[: cfg["max_items_per_bucket"]]
        total = sum(weight[s.id] for s in pool)
        for s in pool:
            w = weight[s.id] / total
            out.append({"id": s.id, "name": s.name, "bucket": bucket,
                        "hours_per_week": round(hours * share * w, 1),
                        "usd_per_month": round(budget * share * w)})
    return out
