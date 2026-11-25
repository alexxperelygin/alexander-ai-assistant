"""Собирает таблицу адресатов и черновики писем из prospects_src.py. Запуск: python outreach/build.py"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from capital_os import compliance  # noqa: E402
from prospects_src import MAIN, RESERVE  # noqa: E402

EN = """Subject: {Short} at {org} — a three-week pilot

Hello{name},

I noticed that {fact}.

I set up AI agents on one routine back-office process at a time for trading businesses. For {org} I would start with {process}: the agents prepare the output, and your employee reviews and approves it.

The format is a three-week paid pilot. We write the acceptance criterion before work starts, run the agents side by side with your team on real cases, and your employee accepts or rejects the result against that criterion. You get the working process, a log of mismatches against manual work, and a plain count of hours saved and of where the agent fails.

To be straightforward: this is a new practice and I have no client case studies yet. What I can show is how I work: [ссылка на публикацию] is a study of my own where the criteria were fixed before the data, all four hypotheses failed, and I published the result anyway.

If {short} is not the right process, tell me which one costs your team the most hours, and I will say honestly whether agents can handle it today.

Would a 20-minute call next week make sense?

[Имя отправителя]
[контакт]
"""

RU_CSCALP = """Тема: Разбор обращений в поддержку CScalp — пилот на три недели

Здравствуйте,

На вашем сайте описано, как работает поддержка: обращения принимаются по почте, отвечают живые специалисты в порядке очереди, первый ответ — от 30 минут до 2 часов, и к письму нужны версия, биржа, скриншот и логи.

Я настраиваю ИИ-агентов на один рутинный процесс в трейдинговых компаниях. Для CScalp я бы начал с приёма обращений: агент проверяет, всё ли приложено, запрашивает недостающее и готовит черновик ответа, а ваш специалист его проверяет и отправляет.

Формат — оплачиваемый пилот на три недели. Критерий приёмки записываем до начала работы, агент работает параллельно с вашей командой на реальных обращениях, и ваш сотрудник принимает или не принимает результат по этому критерию. Вы получаете работающий процесс, журнал расхождений с ручной работой и честный подсчёт: сколько часов он снимает и где агент ошибается.

Скажу прямо: практика новая, клиентских кейсов у меня пока нет. Могу показать, как я работаю: [ссылка на публикацию] — моё собственное исследование, где критерии были записаны до данных, все четыре гипотезы не подтвердились, и я опубликовал результат как есть.

Если приём обращений — не тот процесс, напишите, какой отнимает у команды больше всего часов, и я честно отвечу, справятся ли с ним агенты сегодня.

Удобно ли созвониться на 20 минут на следующей неделе?

[Имя отправителя]
[контакт]
"""


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main() -> int:
    out = HERE / "letters"
    out.mkdir(exist_ok=True)
    for old in out.glob("*.md"):
        old.unlink()
    rows, blocked = [], 0
    for n, (org, seg, site, country, person, channel, fact, process, short, src, conf, flags) in enumerate(MAIN, 1):
        if org == "CScalp":
            text = RU_CSCALP
        else:
            first = f" {person.split(',')[0].split()[0]}" if person else ""
            text = EN.format(Short=short[0].upper() + short[1:], short=short, org=org, name=first, fact=fact, process=process)
        if compliance.is_blocked(text):
            blocked += 1
        head = (f"<!-- №{n} · {org} · {seg} · канал: {channel} · адресат: {person or 'не опубликован'} · "
                f"источник наблюдения: {src} · уверенность: {conf} -->\n\n")
        (out / f"{n:02d}-{slug(org)}.md").write_text(head + text, encoding="utf-8")
        rows.append(f"| {n} | {org} | {seg} | {country} | {person or '—'} | {channel} | {conf} | {flags or '—'} | [источник]({src}) |")
    md = ["# Адресаты: 40 основных и 9 запасных", "",
          "Собрано веб-поиском 25 ноября 2026. Каждая строка — утверждение агента, а не проверенный факт:",
          "перед отправкой открыть источник и сверить. Личные адреса не подбирались — только каналы,",
          "опубликованные самими организациями.", "",
          "| № | организация | сегмент | страна | адресат | канал | уверенность | пометки | наблюдение |",
          "|---|---|---|---|---|---|---|---|---|", *rows, "",
          "## Запасные", "", "| организация | сегмент | сайт | страна | почему в запасе |", "|---|---|---|---|---|",
          *[f"| {o} | {s} | {w} | {c} | {why} |" for o, s, w, c, why in RESERVE], ""]
    (HERE / "PROSPECTS.md").write_text("\n".join(md), encoding="utf-8")
    print(f"писем: {len(MAIN)}, запасных: {len(RESERVE)}, заблокировано шлюзом: {blocked}")
    return 1 if blocked else 0


if __name__ == "__main__":
    sys.exit(main())
