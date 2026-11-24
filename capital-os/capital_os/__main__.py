"""Командная строка: python -m capital_os <команда>."""
import argparse
import json
import sys
from datetime import date

from . import agent, compliance, experiments, kb as kbmod, montecarlo as mc, scoring


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="capital_os", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cycle", help="полный цикл агента, отчёт в status/capital-os.md")
    c.add_argument("--n", type=int, default=50_000, help="число прогонов Монте-Карло")
    c.add_argument("--no-llm", action="store_true", help="без обращения к модели")
    sub.add_parser("rank", help="рейтинг возможностей")
    s = sub.add_parser("simulate", help="Монте-Карло по стратегиям")
    s.add_argument("--n", type=int, default=50_000)
    s.add_argument("--sensitivity", action="store_true")
    k = sub.add_parser("kb", help="поиск по базе исследований")
    k.add_argument("query", nargs="*")
    g = sub.add_parser("gate", help="проверить текст комплаенс-шлюзом")
    g.add_argument("text")
    f = sub.add_parser("freeze", help="заморозить критерии эксперимента")
    f.add_argument("id")
    f.add_argument("--start", required=True, help="дата старта ГГГГ-ММ-ДД")
    sub.add_parser("verdict", help="вердикты по замороженным экспериментам")
    a = p.parse_args(argv)

    if a.cmd == "cycle":
        r = agent.cycle(n=a.n, use_llm=not a.no_llm)
        print(f"Отчёт: {agent.REPORT} (план: {r['plan_source']}; {r['llm_note']})")
    elif a.cmd == "rank":
        for i, x in enumerate(scoring.rank(scoring.load_opportunities()), 1):
            print(f"{i:2}. {x.id:24} p={x.p:.2f}  EV={agent.usd(x.ev_usd):>12}  на месяц={agent.usd(x.ev_per_month):>12}  p($1 млрд)={x.p_billion:.4f}")
    elif a.cmd == "simulate":
        m = mc.load_model()
        out = mc.sensitivity(m, n=a.n) if a.sensitivity else mc.run_all(m, n=a.n)
        print(json.dumps(out, ensure_ascii=False, indent=1))
    elif a.cmd == "kb":
        kb = kbmod.load_all()
        hits = kbmod.search(kb, " ".join(a.query)) if a.query else list(kb.values())
        for h in hits:
            print(f"[{h.id}] {h.source}\n    {h.finding}\n    → {h.rule}")
        print(f"\n{len(hits)} из {len(kb)}")
    elif a.cmd == "gate":
        issues = compliance.check_text(a.text)
        for i in issues:
            print(f"{i['level']}: {i['why']}" + (f" [{i['match']}]" if i["match"] else ""))
        print("ЗАБЛОКИРОВАНО" if compliance.is_blocked(a.text) else "пропущено")
        return 1 if compliance.is_blocked(a.text) else 0
    elif a.cmd == "freeze":
        o = next((o for o in scoring.load_opportunities() if o["id"] == a.id), None)
        if not o:
            print(f"нет возможности {a.id}", file=sys.stderr)
            return 2
        spec = experiments.freeze(o, date.fromisoformat(a.start))
        print(f"Заморожено до {spec['deadline']}, sha256 {spec['sha256'][:12]}")
    elif a.cmd == "verdict":
        obs = experiments.load_observations()
        for spec in experiments.load_frozen():
            v = experiments.verdict(spec, obs.get(spec["id"]), date.today())
            print(f"{v['id']}: {v['verdict']} — {v['why']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
