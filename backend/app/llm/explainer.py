"""Интеграция с LLM (OpenAI-совместимый API) для генерации объяснений по отпускному графику."""

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
    model: str = "openai/gpt-4o-mini",
    base_url: str = "https://orb.bot.zxc-info.info/v1",
    alternative_slots: list[tuple[date, date]] | None = None,
) -> str:
    """
    Генерирует понятное объяснение переноса отпуска для сотрудника.

    Если пожелание #1 не выполнено — объясняет причину и предлагает
    альтернативные периоды (FR-AI-05, FR-AI-06).
    """
    if not api_key or api_key.startswith("sk-placeholder"):
        return _fallback_explanation(
            employee_name, wish_start, wish_end,
            assigned_start, assigned_end, reason, alternative_slots,
        )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)

        alt_text = ""
        if alternative_slots:
            slots = [
                f"{s.strftime('%d.%m')}–{e.strftime('%d.%m.%Y')}"
                for s, e in alternative_slots[:2]
            ]
            alt_text = (
                f" Доступные альтернативные периоды для рассмотрения: {', '.join(slots)}."
            )

        system_prompt = (
            "Ты — HR-ассистент производственной компании. "
            "Пишешь короткие, дружелюбные объяснения сотрудникам о переносах отпуска. "
            "Стиль: профессиональный, но без бюрократизма. Без технического жаргона. "
            "Длина ответа: строго 2–4 предложения. Только русский язык."
        )

        user_prompt = (
            f"Сотрудник {employee_name} запросил отпуск с "
            f"{wish_start.strftime('%d %B %Y')} по {wish_end.strftime('%d %B %Y')}. "
            f"Система назначила другой период: с {assigned_start.strftime('%d %B %Y')} "
            f"по {assigned_end.strftime('%d %B %Y')}. "
            f"Причина переноса: {reason}.{alt_text} "
            "Напиши объяснение для сотрудника: почему его период не подошёл, "
            "какой период назначен и (если есть альтернативы) упомяни их как варианты "
            "для обсуждения с менеджером."
        )

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=300,
            temperature=0.6,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        log.warning("Запрос к LLM завершился ошибкой: %s", e)
        return _fallback_explanation(
            employee_name, wish_start, wish_end,
            assigned_start, assigned_end, reason, alternative_slots,
        )


async def generate_conflict_explanation(
    conflict_code: str,
    description: str,
    workshop_name: str | None,
    employee_name: str | None,
    period: str | None,
    api_key: str,
    model: str = "openai/gpt-4o-mini",
    base_url: str = "https://orb.bot.zxc-info.info/v1",
) -> str:
    """
    Генерирует AI-объяснение и рекомендацию по конкретному конфликту (UR-11).

    Используется на странице конфликтов менеджера.
    """
    if not api_key or api_key.startswith("sk-placeholder"):
        return _fallback_conflict_explanation(conflict_code, description)

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)

        context_parts = []
        if workshop_name:
            context_parts.append(f"цех: {workshop_name}")
        if employee_name:
            context_parts.append(f"сотрудник: {employee_name}")
        if period:
            context_parts.append(f"период: {period}")
        context = ", ".join(context_parts)

        system_prompt = (
            "Ты — HR-аналитик. Объясняешь менеджеру суть производственного конфликта "
            "в графике отпусков и предлагаешь конкретное решение. "
            "Ответ: 2–3 предложения, только русский язык, практичный тон."
        )

        user_prompt = (
            f"Конфликт [{conflict_code}]: {description}. "
            f"{('Контекст: ' + context + '.') if context else ''} "
            "Объясни причину конфликта и предложи конкретное действие для его устранения."
        )

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=200,
            temperature=0.5,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        log.warning("LLM-запрос для конфликта завершился ошибкой: %s", e)
        return _fallback_conflict_explanation(conflict_code, description)


def _fallback_explanation(
    employee_name: str,
    wish_start: date,
    wish_end: date,
    assigned_start: date,
    assigned_end: date,
    reason: str,
    alternative_slots: list[tuple[date, date]] | None = None,
) -> str:
    alt = ""
    if alternative_slots:
        slots = [
            f"{s.strftime('%d.%m')}–{e.strftime('%d.%m.%Y')}"
            for s, e in alternative_slots[:2]
        ]
        alt = f" Доступные альтернативные периоды: {', '.join(slots)}."
    return (
        f"Ваш приоритетный период ({wish_start.strftime('%d.%m')}–{wish_end.strftime('%d.%m.%Y')}) "
        f"не может быть одобрен: {reason}. "
        f"Вам назначен период {assigned_start.strftime('%d.%m')}–{assigned_end.strftime('%d.%m.%Y')}, "
        f"который обеспечивает необходимое производственное покрытие.{alt}"
    )


def _fallback_conflict_explanation(code: str, description: str) -> str:
    recommendations = {
        "C-01": "Перенесите отпуск одного из сотрудников на другой период, чтобы восстановить минимальное покрытие цеха.",
        "C-02": "Убедитесь, что хотя бы один ключевой специалист остаётся на производстве в этот период.",
        "C-03": "Скорректируйте даты так, чтобы непрерывная часть отпуска составляла не менее 14 дней (ст. 125 ТК РФ).",
        "C-04": "Уменьшите длительность отпуска до нормы сотрудника.",
        "C-05": "Перенесите отпуск за пределы запрещённого высокого сезона.",
        "C-06": "Покрытие близко к минимуму — рекомендуется сдвинуть один из отпусков для снижения риска.",
    }
    rec = recommendations.get(code, "Скорректируйте график для устранения конфликта.")
    return f"{description}. {rec}"
