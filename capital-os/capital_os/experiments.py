"""Пре-регистрация (statistics.3, statistics.4): критерии замораживаются хэшем до данных.

Изменённый после заморозки эксперимент вердикта не получает — так же, как в
PREREGISTRATION*.md проекта MemeScope.
"""
import hashlib
import json
from datetime import date, timedelta

from . import ROOT

DIR = ROOT / "experiments"
CRITERIA = ("id", "hypothesis", "metric", "comparator", "threshold", "min_sample",
            "start", "deadline", "kill_rule")


def _hash(spec: dict) -> str:
    body = json.dumps({k: spec[k] for k in CRITERIA}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(body.encode()).hexdigest()


def freeze(opportunity: dict, start: date) -> dict:
    path = DIR / f"{opportunity['id']}.json"
    if path.exists():
        raise FileExistsError(f"{path.name} уже заморожен; критерии не переписываются")
    e = opportunity["experiment"]
    spec = {"id": opportunity["id"], "hypothesis": e["hypothesis"], "metric": e["metric"],
            "comparator": e["comparator"], "threshold": e["threshold"], "min_sample": e["min_sample"],
            "start": start.isoformat(), "deadline": (start + timedelta(days=e["deadline_days"])).isoformat(),
            "kill_rule": e["kill_rule"]}
    spec["sha256"] = _hash(spec)
    DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return spec


def load_frozen() -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(DIR.glob("*.json"))]


def load_observations() -> dict:
    p = ROOT / "data" / "observations.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def verdict(spec: dict, obs: dict | None, today: date) -> dict:
    """PASS / FAIL / RUNNING / KILL (срок вышел, выборка не добрана) / TAMPERED."""
    if _hash(spec) != spec.get("sha256"):
        return {"id": spec["id"], "verdict": "TAMPERED", "why": "критерии изменены после заморозки"}
    past = today > date.fromisoformat(spec["deadline"])
    if not obs or obs.get("sample", 0) < spec["min_sample"]:
        got = (obs or {}).get("sample", 0)
        if past:
            return {"id": spec["id"], "verdict": "KILL",
                    "why": f"срок вышел, выборка {got} из {spec['min_sample']}: {spec['kill_rule']}"}
        return {"id": spec["id"], "verdict": "RUNNING",
                "why": f"выборка {got} из {spec['min_sample']}, срок до {spec['deadline']}"}
    v, t = obs["value"], spec["threshold"]
    ok = v >= t if spec["comparator"] == ">=" else v <= t
    return {"id": spec["id"], "verdict": "PASS" if ok else "FAIL",
            "why": f"{spec['metric']}: {v} при пороге {spec['comparator']} {t}"
                   + ("" if ok else f". {spec['kill_rule']}")}
