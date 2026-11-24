"""База исследований в два слоя.

research.json — классика: 16 областей по 10 записей. frontier.json — слой 2025–2026,
собранный веб-поиском: базовые частоты, экономика агентов, маршруты, секторы, фронтир науки.
"""
import json
from dataclasses import dataclass

from . import ROOT

TIERS = {"peer", "book", "industry", "internal", "preprint", "press"}


@dataclass(frozen=True)
class Finding:
    id: str          # "область.номер", например "wealth.3"
    domain: str
    source: str
    tier: str
    finding: str
    rule: str
    url: str = ""


def _read(path) -> dict[str, Finding]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, Finding] = {}
    for d in raw["domains"]:
        for n, (source, tier, finding, rule, *url) in enumerate(d["items"], 1):
            if tier not in TIERS:
                raise ValueError(f"{d['id']}.{n}: неизвестный тип источника {tier!r}")
            fid = f"{d['id']}.{n}"
            out[fid] = Finding(fid, d["name"], source, tier, finding, rule, url[0] if url else "")
    return out


def load(path=None) -> dict[str, Finding]:
    """Классический слой."""
    return _read(path or ROOT / "kb" / "research.json")


def load_frontier() -> dict[str, Finding]:
    return _read(ROOT / "kb" / "frontier.json")


def load_all() -> dict[str, Finding]:
    return {**load(), **load_frontier()}


def search(kb: dict[str, Finding], query: str) -> list[Finding]:
    words = query.lower().split()
    return [f for f in kb.values()
            if all(w in f"{f.id} {f.domain} {f.source} {f.finding} {f.rule}".lower() for w in words)]


def as_prompt(kb: dict[str, Finding]) -> str:
    """Компактная выгрузка для системного промпта: идентификатор, источник, правило."""
    lines, domain = [], None
    for f in kb.values():
        if f.domain != domain:
            domain = f.domain
            lines.append(f"\n## {domain}")
        lines.append(f"[{f.id}] {f.source} — {f.finding} ПРАВИЛО: {f.rule}")
    return "\n".join(lines).strip()
