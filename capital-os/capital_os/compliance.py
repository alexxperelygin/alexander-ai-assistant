"""Комплаенс-шлюз: контрольный список в коде (operations.3, risk.7).

Два слоя. Текст: исходящий контент проверяется на обещания доходности,
поддельный дефицит и привлечение средств. Действия: всё необратимое и всё,
что касается денег и чужого капитала, уходит на подтверждение владельцу или
запрещено. Модель не может обойти шлюз: он детерминированный и стоит после неё.
"""
import re

BLOCK, WARN = "BLOCK", "WARN"

TEXT_RULES = [
    (BLOCK, r"гарантир\w*", "Гарантии результата запрещены (retail_trading.7, trust.4)."),
    (BLOCK, r"без\s+риск\w*|безрисков\w*|risk[- ]free", "Утверждение об отсутствии риска."),
    (BLOCK, r"\d+(?:[.,]\d+)?\s*%\s*(?:в|за|per|a)\s*(?:день|сутки|недел\w*|месяц\w*|day|week|month)",
     "Обещание доходности за период."),
    (BLOCK, r"пассивн\w+\s+доход\w*", "«Пассивный доход» — обещание результата."),
    (BLOCK, r"(?:вложи\w*|инвестиру\w+|довер\w+|переда\w+)\s+(?:\S+\s+){0,4}(?:деньги|капитал|средства|депозит)",
     "Привлечение средств: только после заключения юриста и подтверждения владельца (trust.5)."),
    (BLOCK, r"доверительн\w+\s+управлени\w+|войти\s+в\s+фонд|дол\w+\s+в\s+фонде",
     "Предложение управления капиталом без юридического оформления."),
    (WARN, r"\b(?:\d+\s?[xх]|[xх]\s?\d+|иксы?|иксов)\b", "Упоминание «иксов» — проверить, что это не обещание."),
    (WARN, r"только\s+сегодня|осталось\s+\d+\s+мест\w*|последн\w+\s+шанс",
     "Дефицит допустим только настоящий (behavior.3): подтвердить число и срок."),
    (WARN, r"сигнал\w*\s+(?:на\s+)?(?:покупк\w+|вход\w*|лонг\w*|шорт\w*)",
     "Сигнал на аудиторию 16 000 человек: запрещён для неликвидных активов (retail_trading.10, crypto.5)."),
]
MARKET_WORDS = re.compile(r"трейд|торг|инвест|крипт|доходност|позици|сделк|рынк", re.I)
RISK_WORDS = re.compile(r"риск|убыт|потер", re.I)

# auto — агент делает сам; approve — очередь владельцу; forbid — не делается никогда.
ACTION_RULES = {
    "research": "auto", "write_draft": "auto", "analyze_data": "auto", "update_model": "auto",
    "build_prototype": "auto", "prepare_document": "auto",
    "send_mass_message": "approve", "publish_content": "approve", "payment": "approve",
    "sign_contract": "approve", "register_account": "approve", "trade_live": "approve",
    "accept_investor_money": "approve", "contact_creditor": "approve", "contact_person": "approve",
    "guarantee_returns": "forbid", "publish_signal_illiquid": "forbid",
    "borrow_to_repay": "forbid", "undisclosed_promotion": "forbid",
}


def check_text(text: str) -> list[dict]:
    issues = [{"level": lvl, "why": why, "match": m.group(0)}
              for lvl, pat, why in TEXT_RULES for m in re.finditer(pat, text, re.I)]
    if MARKET_WORDS.search(text) and not RISK_WORDS.search(text):
        issues.append({"level": WARN, "why": "Текст о рынке без раскрытия риска.", "match": ""})
    return issues


def is_blocked(text: str) -> bool:
    return any(i["level"] == BLOCK for i in check_text(text))


def check_action(action_type: str) -> str:
    """Неизвестный тип действия требует подтверждения: по умолчанию осторожно."""
    return ACTION_RULES.get(action_type, "approve")
