import copy
import json
from datetime import date

import pytest

from capital_os import agent, compliance, experiments, kb as kbmod, llm, montecarlo as mc, scoring


def test_kb_is_16_domains_of_10():
    kb = kbmod.load()
    assert len(kb) == 160
    assert len({f.domain for f in kb.values()}) == 16
    assert all(f.rule and f.finding and f.source for f in kb.values())


def test_frontier_layer_has_links():
    fr = kbmod.load_frontier()
    assert len(fr) >= 40 and all(f.url.startswith("https://") for f in fr.values())
    assert not set(fr) & set(kbmod.load())


def test_universe_is_not_only_owner_assets():
    items = scoring.load_opportunities()
    assert sum(o.get("origin") == "universe" for o in items) >= 10
    blocked = dict(items[0], access=0.0)
    assert scoring.score(blocked).p == 0


def test_every_opportunity_cites_existing_evidence():
    kb = kbmod.load_all()
    for o in scoring.load_opportunities():
        assert o["evidence"], o["id"]
        assert all(e in kb for e in o["evidence"]), o["id"]


def test_shrinkage_pulls_estimate_toward_base_rate():
    assert scoring.shrink(0.9, 0.1, 0.0) == 0.1
    assert scoring.shrink(0.9, 0.1, 1.0) == 0.9
    assert 0.1 < scoring.shrink(0.9, 0.1, 0.3) < 0.9


def test_discretionary_trading_and_fund_do_not_get_resources():
    ranked = scoring.rank(scoring.load_opportunities())
    alloc = {a["id"] for a in scoring.allocate(ranked, mc.load_model()["allocation"])}
    assert "discretionary-trading" not in alloc and "fund-300m" not in alloc and "own-prop-firm" not in alloc
    hours = sum(a["hours_per_week"] for a in scoring.allocate(ranked, mc.load_model()["allocation"]))
    assert hours == pytest.approx(50, abs=0.5)


def test_simulation_is_deterministic_and_ordered():
    m = mc.load_model()
    a, b = mc.simulate("equity", m, 15, 4000, seed=1), mc.simulate("equity", m, 15, 4000, seed=1)
    assert a == b
    p = a["p_ge"]
    assert p[0] >= p[int(10e6)] >= p[int(100e6)] >= p[int(1e9)]
    assert mc.simulate("trading", m, 15, 4000)["p_ge"][int(1e9)] == 0
    assert set(mc.STRATEGIES) == {"trading", "info", "fund", "equity", "rollup"}


def test_more_debt_never_helps():
    m = mc.load_model()
    hi = copy.deepcopy(m)
    hi["common"]["debt_usd"] *= 2
    assert mc.simulate("equity", hi, 15, 4000)["p_ge"][0] <= mc.simulate("equity", m, 15, 4000)["p_ge"][0]


def test_gate_blocks_promises_and_passes_honest_text():
    assert compliance.is_blocked("Гарантированная прибыль каждому подписчику")
    assert compliance.is_blocked("Доходность 15% в месяц без риска")
    assert compliance.is_blocked("Передайте нам свои средства в доверительное управление")
    honest = "Медиана свежего мем-коина за 6 часов: −93,7%. Риск потери депозита высокий."
    assert not compliance.is_blocked(honest)
    assert compliance.check_text(honest) == []
    assert any(i["level"] == "WARN" for i in compliance.check_text("Разбор рынка крипты за неделю"))


def test_action_rules_default_to_approval():
    assert compliance.check_action("research") == "auto"
    assert compliance.check_action("payment") == "approve"
    assert compliance.check_action("guarantee_returns") == "forbid"
    assert compliance.check_action("something_new") == "approve"
    assert all(t in compliance.ACTION_RULES for t in llm.ACTION_TYPES)


def test_experiment_freeze_verdict_and_tamper(tmp_path, monkeypatch):
    monkeypatch.setattr(experiments, "DIR", tmp_path)
    o = next(o for o in scoring.load_opportunities() if o["id"] == "risk-desk-sub")
    spec = experiments.freeze(o, date(2026, 12, 1))
    assert spec["deadline"] == "2026-12-31"
    with pytest.raises(FileExistsError):
        experiments.freeze(o, date(2026, 12, 2))
    d = date(2026, 12, 15)
    assert experiments.verdict(spec, None, d)["verdict"] == "RUNNING"
    assert experiments.verdict(spec, {"value": 200, "sample": 16000}, d)["verdict"] == "PASS"
    assert experiments.verdict(spec, {"value": 90, "sample": 16000}, d)["verdict"] == "FAIL"
    assert experiments.verdict(spec, {"value": 90, "sample": 100}, date(2027, 1, 5))["verdict"] == "KILL"
    moved = dict(spec, threshold=50)
    assert experiments.verdict(moved, {"value": 90, "sample": 16000}, d)["verdict"] == "TAMPERED"


def test_gate_routes_model_plan():
    kb = kbmod.load_all()
    plan = {"constraint": "x", "reflection": "", "new_opportunities": [], "estimate_updates": [],
            "actions": [
                {"title": "Собрать реестр кредиторов", "opportunity_id": "debt-restructuring", "why": "",
                 "evidence": ["capital.1"], "action_type": "prepare_document", "owner_minutes": 30, "deliverable": ""},
                {"title": "Разослать оффер", "opportunity_id": "risk-desk-sub", "why": "",
                 "evidence": ["nope.1"], "action_type": "send_mass_message", "owner_minutes": 10, "deliverable": ""},
                {"title": "Пообещать гарантированный доход", "opportunity_id": "risk-desk-sub", "why": "",
                 "evidence": [], "action_type": "write_draft", "owner_minutes": 0, "deliverable": ""}],
            "content_drafts": [{"channel": "Telegram", "purpose": "прогрев", "text": "Гарантируем 20% в месяц"},
                               {"channel": "Telegram", "purpose": "отчёт", "text": "13% мем-коинов прибыльны. Риск высокий."}]}
    g = agent.gate(plan, {"debt-restructuring", "risk-desk-sub"}, kb)
    assert [a["title"] for a in g["auto"]] == ["Собрать реестр кредиторов"]
    assert g["queue"][0]["note"].startswith("ссылки не найдены")
    assert len(g["dropped"]) == 1
    assert [d["blocked"] for d in g["drafts"]] == [True, False]


def test_cycle_offline_renders_report():
    r = agent.cycle(n=3000, use_llm=False, today=date(2026, 11, 24), write=False)
    text = agent.render(r)
    assert r["plan_source"] == "offline"
    assert "## Рейтинг возможностей" in text and "$1 млрд" in text
    json.dumps(llm.PLAN_SCHEMA)
