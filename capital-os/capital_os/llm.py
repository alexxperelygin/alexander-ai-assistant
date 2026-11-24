"""Слой рассуждения: Claude Fable 5.2 через официальный SDK.

Модель получает базу исследований (кэшируемый системный блок) и состояние
системы, возвращает план недели в строгой схеме. Числа считает код; модель
предлагает действия, тексты и новые гипотезы. Всё, что она предложит, проходит
через compliance.py.
"""
import json
import os

MODEL = os.environ.get("CAPITAL_OS_MODEL", "claude-fable-5-2")
EFFORT = os.environ.get("CAPITAL_OS_EFFORT", "high")

ACTION_TYPES = ["research", "write_draft", "analyze_data", "update_model", "build_prototype",
                "prepare_document", "send_mass_message", "publish_content", "payment", "sign_contract",
                "register_account", "trade_live", "accept_investor_money", "contact_creditor", "contact_person"]


def _obj(props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


_S = {"type": "string"}
PLAN_SCHEMA = _obj({
    "constraint": _S,
    "actions": {"type": "array", "items": _obj({
        "title": _S, "opportunity_id": _S, "why": _S,
        "evidence": {"type": "array", "items": _S},
        "action_type": {"type": "string", "enum": ACTION_TYPES},
        "owner_minutes": {"type": "integer"},
        "deliverable": _S})},
    "content_drafts": {"type": "array", "items": _obj({"channel": _S, "purpose": _S, "text": _S})},
    "new_opportunities": {"type": "array", "items": _obj({
        "name": _S, "thesis": _S, "reference_class": _S, "base_rate": {"type": "number"},
        "evidence": {"type": "array", "items": _S}})},
    "estimate_updates": {"type": "array", "items": _obj({
        "opportunity_id": _S, "field": _S, "new_value": {"type": "number"}, "why": _S})},
    "reflection": _S,
})

SYSTEM = """Ты — операционный агент системы Capital OS. Владелец — предприниматель и трейдер \
с аудиторией 16 000 читателей в Telegram, базой 9 000 тёплых контактов и долгом около $20 млн. \
Цель системы: погасить долг и вырастить долю владельца в масштабируемой компании; дальняя цель — \
$1 млрд чистого капитала. Поиск возможностей не ограничен текущими проектами и отраслью владельца: \
его аудитория, контакты и опыт — множитель в оценке, а не рамка. В new_opportunities предлагай \
варианты из любой отрасли, если базовая частота и потолок это оправдывают. Модель Монте-Карло оценивает её вероятность долями процента, и твоя \
работа — честно двигать рычаги, от которых она зависит, а не обещать результат.

Как ты работаешь:
- Ранжирование, вероятности и распределение ресурсов уже посчитаны кодом и даны в состоянии. \
Не пересчитывай их и не спорь с порядком словами; если считаешь входную оценку неверной, \
предложи правку в estimate_updates с обоснованием и ссылкой на данные.
- Каждое действие ссылается на записи базы исследований по идентификатору (например wealth.3). \
Если опоры в базе нет, так и напиши в why — это гипотеза.
- constraint — одно узкое место системы на эту неделю; действия направлены на него.
- Действий не больше семи. Суммарное время владельца укладывается в его недельный бюджет часов. \
Всё, что можешь сделать сам (исследование, черновик, документ, анализ, прототип), — делай сам \
и помечай соответствующим action_type; владельцу оставляй только решения, деньги, подписи и \
публикацию от его имени.
- content_drafts — готовые к публикации тексты на русском в спокойном экспертном тоне. \
Никаких гарантий и обещаний доходности, никакого поддельного дефицита, раскрытие риска \
обязательно. Сила текста — в неожиданных честных числах из собственных измерений.
- new_opportunities — только если видишь возможность сильнее имеющихся; укажи референсный \
класс и базовую частоту успеха.
- reflection — что в прошлом цикле сработало и что нет, по журналу и вердиктам; её прочтёт \
следующий цикл.

Пределы: ты не распоряжаешься деньгами, не привлекаешь чужой капитал, не публикуешь от имени \
владельца и не торгуешь — такие действия уходят в очередь на подтверждение. Закрытые вердиктом \
гипотезы не возвращаются без новых данных.

# База исследований
"""


def available() -> bool:
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def plan(kb_prompt: str, state: dict) -> tuple[dict | None, str]:
    """Возвращает (план, примечание). План равен None, если модель недоступна или отказала."""
    if not available():
        return None, "модель не подключена (нет пакета anthropic или ключа ANTHROPIC_API_KEY)"
    import anthropic

    client = anthropic.Anthropic()
    try:
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=64000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": PLAN_SCHEMA}},
            system=[{"type": "text", "text": SYSTEM + kb_prompt, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content":
                       "Состояние системы на текущий цикл:\n" + json.dumps(state, ensure_ascii=False, indent=1)}],
        ) as stream:
            msg = stream.get_final_message()
    except anthropic.AuthenticationError:
        return None, "ключ API отклонён"
    except anthropic.RateLimitError:
        return None, "превышен лимит запросов, цикл выполнен без модели"
    except anthropic.APIStatusError as e:
        return None, f"ошибка API {e.status_code}: {e.message}"
    except anthropic.APIConnectionError:
        return None, "нет соединения с API"

    if msg.stop_reason == "refusal":
        return None, "модель отклонила запрос"
    if msg.stop_reason == "max_tokens":
        return None, "ответ обрезан по лимиту токенов"
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        return json.loads(text), f"план составлен моделью {msg.model}"
    except json.JSONDecodeError:
        return None, "модель вернула невалидный JSON"
