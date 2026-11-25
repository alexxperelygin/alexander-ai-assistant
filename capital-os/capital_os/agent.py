"""Цикл агента: наблюдение → расчёт → план → шлюз → отчёт → разбор (ai.2, ai.3, ai.4)."""
import json
from datetime import date

from . import REPO, ROOT, compliance, experiments, kb as kbmod, llm, montecarlo as mc, scoring

REPORT = REPO / "status" / "capital-os.md"
JOURNAL = ROOT / "state" / "journal.jsonl"
KIND_RU = {"cash": "кэш", "liability": "долг", "equity": "доля", "trading": "торговля", "fund": "фонд"}
APPROVE_RU = {
    "send_mass_message": "рассылка по базе", "publish_content": "публикация от имени владельца",
    "payment": "расход денег", "sign_contract": "подпись документа", "register_account": "регистрация аккаунта",
    "trade_live": "торговля реальными деньгами", "accept_investor_money": "приём средств инвесторов",
    "contact_creditor": "обращение к кредитору", "contact_person": "личное обращение",
}


def usd(x: float) -> str:
    a, sign = abs(x), "−" if x < 0 else ""
    if a >= 1e9:
        return f"{sign}${a / 1e9:.2f} млрд".replace(".", ",")
    if a >= 1e6:
        return f"{sign}${a / 1e6:.1f} млн".replace(".", ",")
    if a >= 1e3:
        return f"{sign}${a / 1e3:.0f} тыс."
    return f"{sign}${a:.0f}"


def pct(x: float) -> str:
    if x == 0:
        return "0%"
    if x < 0.0001:
        return "<0,01%"
    return (f"{x * 100:.2f}%" if x < 0.1 else f"{x * 100:.0f}%").replace(".", ",")


def last_reflection() -> str:
    if not JOURNAL.exists():
        return ""
    lines = JOURNAL.read_text(encoding="utf-8").strip().splitlines()
    return json.loads(lines[-1]).get("reflection", "") if lines else ""


def offline_plan(alloc: list[dict], by_id: dict) -> dict:
    """План без модели: следующий шаг эксперимента по каждой позиции распределения."""
    actions = []
    for a in alloc:
        o = by_id[a["id"]]
        actions.append({"title": o["experiment"]["next_step"], "opportunity_id": o["id"], "why": o["thesis"],
                        "evidence": o["evidence"], "action_type": "prepare_document",
                        "owner_minutes": round(a["hours_per_week"] * 60),
                        "deliverable": f"Критерий: {o['experiment']['hypothesis']}",
                        "then_needs": o.get("approvals", [])})
    top = by_id[alloc[0]["id"]]
    return {"constraint": f"{top['name']}: наибольшая ожидаемая ценность на месяц работы.",
            "actions": actions, "content_drafts": [], "new_opportunities": [], "estimate_updates": [],
            "reflection": ""}


def gate(plan: dict, known_ids: set, kb: dict) -> dict:
    """Детерминированный фильтр после модели: действия, тексты и ссылки на источники."""
    auto, queue, dropped, drafts = [], [], [], []
    for a in plan["actions"]:
        bad_refs = [e for e in a.get("evidence", []) if e not in kb]
        if a["opportunity_id"] not in known_ids and a["opportunity_id"]:
            a["note"] = "возможность вне реестра — считать гипотезой"
        if bad_refs:
            a["note"] = f"ссылки не найдены в базе: {', '.join(bad_refs)}"
        decision = compliance.check_action(a["action_type"])
        if decision == "forbid" or compliance.is_blocked(a["title"]):
            dropped.append(a)
        elif decision == "approve":
            queue.append(a)
        else:
            auto.append(a)
    for d in plan["content_drafts"]:
        d["issues"] = compliance.check_text(d["text"])
        d["blocked"] = any(i["level"] == compliance.BLOCK for i in d["issues"])
        drafts.append(d)
    return {"auto": auto, "queue": queue, "dropped": dropped, "drafts": drafts}


def cycle(n: int = 50_000, use_llm: bool = True, today: date | None = None, write: bool = True) -> dict:
    today = today or date.today()
    kb = kbmod.load_all()
    items = scoring.load_opportunities()
    by_id = {o["id"]: o for o in items}
    model = mc.load_model()
    ranked = scoring.rank(items)
    alloc = scoring.allocate(ranked, model["allocation"])
    sims = mc.run_all(model, n=n)
    sens = mc.sensitivity(model, n=max(10_000, n // 2))
    obs = experiments.load_observations()
    verdicts = [experiments.verdict(s, obs.get(s["id"]), today) for s in experiments.load_frozen()]
    frozen_ids = {v["id"] for v in verdicts}

    state = {
        "date": today.isoformat(),
        "ranking": [{"id": s.id, "name": s.name, "kind": s.kind, "p_success": round(s.p, 3),
                     "ev_usd": round(s.ev_usd), "ev_per_month": round(s.ev_per_month),
                     "p_billion": round(s.p_billion, 5), "experiment": s.raw["experiment"]} for s in ranked],
        "allocation": alloc,
        "simulation": [{"strategy": r["strategy"], "years": r["years"], "p_ge": r["p_ge"],
                        "median": round(r["median"])} for r in sims],
        "sensitivity": sens, "experiment_verdicts": verdicts,
        "owner_hours_per_week": model["allocation"]["owner_hours_per_week"],
        "previous_reflection": last_reflection(),
    }
    plan, note = (llm.plan(kbmod.as_prompt(kb), state) if use_llm else (None, "модель отключена флагом"))
    source = "model"
    if plan is None:
        plan, source = offline_plan(alloc, by_id), "offline"
    gated = gate(plan, set(by_id), kb)

    result = {"date": today.isoformat(), "plan_source": source, "llm_note": note, "ranked": ranked,
              "alloc": alloc, "sims": sims, "sens": sens, "verdicts": verdicts, "frozen_ids": frozen_ids,
              "plan": plan, "gated": gated, "by_id": by_id, "kb_size": len(kb)}
    if write:
        REPORT.parent.mkdir(exist_ok=True)
        REPORT.write_text(render(result), encoding="utf-8")
        JOURNAL.parent.mkdir(exist_ok=True)
        with JOURNAL.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"date": today.isoformat(), "source": source, "constraint": plan["constraint"],
                                "verdicts": verdicts, "reflection": plan.get("reflection", "")},
                               ensure_ascii=False) + "\n")
    return result


def _action_lines(a: dict) -> list[str]:
    out = [f"- **{a['title']}**",
           f"  - возможность: `{a['opportunity_id']}`; опора: {', '.join(a.get('evidence', [])) or 'нет — гипотеза'}",
           f"  - зачем: {a['why']}",
           f"  - результат: {a['deliverable']}",
           "  - время владельца: " + (f"{a['owner_minutes'] / 60:.1f} ч".replace(".", ",") if a["owner_minutes"] >= 120
                                      else f"{a['owner_minutes']} мин")]
    if a.get("then_needs"):
        out.append("  - дальше потребует подтверждения: " + ", ".join(APPROVE_RU.get(x, x) for x in a["then_needs"]))
    if a.get("note"):
        out.append(f"  - примечание шлюза: {a['note']}")
    return out


def render(r: dict) -> str:
    eq15 = max((s for s in r["sims"] if s["years"] == 15), key=lambda s: s["p_ge"][int(1e9)])
    L = [f"# Capital OS — отчёт цикла {r['date']}", "",
         f"База исследований: {r['kb_size']} записей в двух слоях (классика и слой 2025–2026). План: "
         + ("составлен моделью" if r["plan_source"] == "model" else "детерминированный, без модели")
         + f" ({r['llm_note']}).", "",
         "## Главное", "",
         f"- Вероятность чистого капитала от $1 млрд за 15 лет при лучшей стратегии ({mc.STRATEGIES[eq15['strategy']].lower()}): **{pct(eq15['p_ge'][int(1e9)])}**; "
         f"от $100 млн: {pct(eq15['p_ge'][int(100e6)])}; полного погашения долга: {pct(eq15['p_ge'][0])}.",
         "- Это оценка модели на допущениях из `capital-os/data/model.json`, а не прогноз.",
         f"- Узкое место недели: {r['plan']['constraint']}", "",
         "## Рейтинг возможностей", "",
         "| № | возможность | тип | откуда | вероятность успеха | ожидаемая ценность за 3 года | на месяц работы | вероятность $1 млрд |",
         "|---|---|---|---|---|---|---|---|"]
    for i, s in enumerate(r["ranked"], 1):
        L.append(f"| {i} | {s.name} | {KIND_RU[s.kind]} | {'поиск' if s.raw.get('origin') == 'universe' else 'активы'} | {pct(s.p)} | {usd(s.ev_usd)} | {usd(s.ev_per_month)} | {pct(s.p_billion)} |")
    L += ["", "«Поиск» — найдено исследованием без привязки к текущим проектам владельца; «активы» — выросло из "
          "имеющихся. Вероятность успеха уже умножена на доступность входа (капитал, лицензия, партнёр). "
          "Отрицательная ожидаемая ценность означает: при текущих оценках не делать.", "",
          "## Распределение ресурсов владельца", "", "| возможность | корзина | часов в неделю | бюджет в месяц |", "|---|---|---|---|"]
    for a in r["alloc"]:
        L.append(f"| {a['name']} | {a['bucket']} | {a['hours_per_week']} | {usd(a['usd_per_month'])} |")

    L += ["", "## Модель: чистый капитал по стратегиям", "",
          "| горизонт | стратегия | долг погашен | от $10 млн | от $100 млн | от $1 млрд | медиана | 99-й перцентиль |",
          "|---|---|---|---|---|---|---|---|"]
    for s in r["sims"]:
        p = s["p_ge"]
        L.append(f"| {s['years']} лет | {mc.STRATEGIES[s['strategy']]} | {pct(p[0])} | {pct(p[int(10e6)])} | "
                 f"{pct(p[int(100e6)])} | {pct(p[int(1e9)])} | {usd(s['median'])} | {usd(s['p99'])} |")
    L += ["", f"Число прогонов на строку: {r['sims'][0]['n']:,}.".replace(",", " "), "",
          "## Чувствительность: что двигает вероятность миллиарда", "",
          "Стратегия с долей в компании, 15 лет. Каждый параметр по очереди уменьшен вдвое и увеличен в полтора раза.", "",
          "| параметр | база | при ×0,5: $1 млрд | при ×1,5: $1 млрд | при ×0,5: долг погашен | при ×1,5: долг погашен |",
          "|---|---|---|---|---|---|"]
    for row in sorted(r["sens"], key=lambda x: -abs(x["high"]["p_1b"] - x["low"]["p_1b"])):
        L.append(f"| `{row['param']}` | {row['base']:g} | {pct(row['low']['p_1b'])} | {pct(row['high']['p_1b'])} | "
                 f"{pct(row['low']['p_debt_free'])} | {pct(row['high']['p_debt_free'])} |")

    L += ["", "## Эксперименты", ""]
    if r["verdicts"]:
        L += ["| эксперимент | вердикт | основание |", "|---|---|---|"]
        L += [f"| `{v['id']}` | **{v['verdict']}** | {v['why']} |" for v in r["verdicts"]]
    else:
        L.append("Замороженных экспериментов нет.")
    todo = [a["id"] for a in r["alloc"] if a["id"] not in r["frozen_ids"]]
    if todo:
        L += ["", "К заморозке в день старта (`python -m capital_os freeze <id> --start ГГГГ-ММ-ДД`): "
              + ", ".join(f"`{x}`" for x in todo) + "."]

    g = r["gated"]
    L += ["", "## План недели", ""]
    if g["auto"]:
        L += ["### Агент делает сам" if r["plan_source"] == "model" else "### Следующие шаги по экспериментам", ""] + [x for a in g["auto"] for x in _action_lines(a)] + [""]
    if g["queue"]:
        L += ["### Очередь на подтверждение владельцу", ""]
        for a in g["queue"]:
            L += _action_lines(a) + [f"  - требуется: {APPROVE_RU.get(a['action_type'], a['action_type'])}"]
        L.append("")
    if g["dropped"]:
        L += ["### Отклонено шлюзом", ""] + [f"- {a['title']} ({a['action_type']})" for a in g["dropped"]] + [""]

    if g["drafts"]:
        L += ["## Черновики контента", ""]
        for d in g["drafts"]:
            L += [f"### {d['channel']}: {d['purpose']}", ""]
            if d["blocked"]:
                L += ["Заблокирован шлюзом: " + "; ".join(i["why"] for i in d["issues"] if i["level"] == "BLOCK"), ""]
                continue
            L += [d["text"], ""]
            L += [f"> Проверить перед публикацией: {i['why']}" for i in d["issues"]] + [""]
    if r["plan"].get("new_opportunities"):
        L += ["## Новые гипотезы от модели (в реестр не внесены)", ""]
        L += [f"- **{o['name']}** — {o['thesis']} Референсный класс: {o['reference_class']}, базовая частота {pct(o['base_rate'])}."
              for o in r["plan"]["new_opportunities"]] + [""]
    if r["plan"].get("estimate_updates"):
        L += ["## Предложенные правки оценок (применяет владелец)", ""]
        L += [f"- `{u['opportunity_id']}`.{u['field']} → {u['new_value']}: {u['why']}" for u in r["plan"]["estimate_updates"]] + [""]
    if r["plan"].get("reflection"):
        L += ["## Разбор цикла", "", r["plan"]["reflection"], ""]
    return "\n".join(L).rstrip() + "\n"
