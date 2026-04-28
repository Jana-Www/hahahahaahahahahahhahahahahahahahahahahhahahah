"""OpenAI GPT-4o-mini integration for generating vacation schedule explanations."""

from __future__ import annotations

import logging
from datetime import date

log = logging.getLogger(__name__)


async def generate_explanation(
    employee_name: str,
    wish_start: date,
    wish_end: date,
    assigned_start: date,
    assigned_end: date,
    reason: str,
    api_key: str,
    model: str = "gpt-4o-mini",
) -> str:
    """Generate a human-readable explanation for a schedule change."""
    if not api_key or api_key == "sk-placeholder":
        return _fallback_explanation(employee_name, wish_start, wish_end, assigned_start, assigned_end, reason)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        prompt = (
            f"Сотрудник {employee_name} запросил отпуск с {wish_start.strftime('%d.%m.%Y')} "
            f"по {wish_end.strftime('%d.%m.%Y')}. "
            f"Система назначила отпуск с {assigned_start.strftime('%d.%m.%Y')} "
            f"по {assigned_end.strftime('%d.%m.%Y')}. "
            f"Причина переноса: {reason}. "
            "Напиши объяснение для сотрудника на русском языке, 2-4 предложения, "
            "без технического жаргона, дружелюбно и конкретно."
        )

        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        log.warning("OpenAI call failed: %s", e)
        return _fallback_explanation(employee_name, wish_start, wish_end, assigned_start, assigned_end, reason)


def _fallback_explanation(
    employee_name: str,
    wish_start: date,
    wish_end: date,
    assigned_start: date,
    assigned_end: date,
    reason: str,
) -> str:
    return (
        f"Ваш приоритетный период отпуска ({wish_start.strftime('%d.%m')}–{wish_end.strftime('%d.%m.%Y')}) "
        f"не может быть одобрен: {reason}. "
        f"Вместо этого вам назначен период {assigned_start.strftime('%d.%m')}–{assigned_end.strftime('%d.%m.%Y')}, "
        f"который обеспечивает необходимое производственное покрытие."
    )
