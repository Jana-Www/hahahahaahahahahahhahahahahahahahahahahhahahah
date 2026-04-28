from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.deps import get_db, require_manager
from app.llm.explainer import generate_conflict_explanation, _fallback_conflict_explanation
from app.models.models import (
    CoverageRule, SeasonPeriod, SeasonStatus,
    Shift, User, VacationBlock, VacationStatus, Workshop,
)
from app.schemas.schemas import ConflictItem

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


def _daterange(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


async def _ai_rec(code: str, description: str, workshop_name: str | None = None,
                  employee_name: str | None = None, period: str | None = None) -> str:
    """Получить AI-рекомендацию; при отсутствии ключа — шаблон."""
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-placeholder"):
        return _fallback_conflict_explanation(code, description)
    return await generate_conflict_explanation(
        conflict_code=code,
        description=description,
        workshop_name=workshop_name,
        employee_name=employee_name,
        period=period,
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        base_url=settings.OPENAI_BASE_URL,
    )


@router.get("", response_model=list[ConflictItem])
async def get_conflicts(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    conflicts: list[ConflictItem] = []

    blocks_res = await db.execute(
        select(VacationBlock).where(
            VacationBlock.year == year,
            VacationBlock.status.in_([
                VacationStatus.DRAFT, VacationStatus.PENDING,
                VacationStatus.APPROVED, VacationStatus.MODIFIED,
            ]),
        )
    )
    blocks = blocks_res.scalars().all()

    periods_res = await db.execute(select(SeasonPeriod).where(SeasonPeriod.year == year))
    periods = periods_res.scalars().all()

    rules_res = await db.execute(select(CoverageRule))
    rules = rules_res.scalars().all()

    workshops_res = await db.execute(select(Workshop))
    workshops = {w.id: w for w in workshops_res.scalars().all()}

    shifts_res = await db.execute(select(Shift))
    shifts = {s.id: s for s in shifts_res.scalars().all()}

    users_res = await db.execute(select(User))
    users = {u.id: u for u in users_res.scalars().all()}

    # Кеш AI-ответов: не вызываем LLM дважды для одного и того же кода+контекста
    ai_cache: dict[str, str] = {}

    async def cached_rec(code: str, desc: str, ws: str | None = None,
                         emp: str | None = None, period: str | None = None) -> str:
        cache_key = f"{code}:{ws}:{emp}"
        if cache_key not in ai_cache:
            ai_cache[cache_key] = await _ai_rec(code, desc, ws, emp, period)
        return ai_cache[cache_key]

    # C-03: часть отпуска < 14 дней (нарушение ТК РФ)
    for b in blocks:
        days = (b.date_end - b.date_start).days + 1
        if days < 14:
            u = users.get(b.user_id)
            name = u.full_name if u else None
            desc = f"Часть отпуска {days} дн. — менее 14 дней подряд (ТК РФ ст.125)"
            rec = await cached_rec("C-03", desc, employee_name=name)
            conflicts.append(ConflictItem(
                code="C-03", severity="critical", description=desc,
                employee_name=name,
                date_start=b.date_start, date_end=b.date_end,
                ai_recommendation=rec,
            ))

    # C-05: отпуск в запрещённый HIGH-период
    for b in blocks:
        for p in periods:
            if p.status == SeasonStatus.HIGH and p.date_start <= b.date_end and p.date_end >= b.date_start:
                u = users.get(b.user_id)
                shift = shifts.get(u.shift_id) if u and u.shift_id else None
                rule = next(
                    (r for r in rules if r.workshop_id == shift.workshop_id
                     and r.period_status == SeasonStatus.HIGH),
                    None,
                ) if shift else None
                if rule and rule.max_on_vacation == 0:
                    name = u.full_name if u else None
                    desc = "Отпуск в запрещённый HIGH-период (квота 0)"
                    period_str = f"{b.date_start.strftime('%d.%m')}–{b.date_end.strftime('%d.%m.%Y')}"
                    rec = await cached_rec("C-05", desc, employee_name=name, period=period_str)
                    conflicts.append(ConflictItem(
                        code="C-05", severity="critical", description=desc,
                        employee_name=name,
                        date_start=b.date_start, date_end=b.date_end,
                        ai_recommendation=rec,
                    ))

    # C-01 / C-02: покрытие по цеху
    rule_map: dict[str, CoverageRule] = {}
    for r in rules:
        key = f"{r.workshop_id}_{r.period_status}"
        rule_map[key] = r

    workshop_day_absent: dict[tuple, list[str]] = defaultdict(list)
    for b in blocks:
        u = users.get(b.user_id)
        if not u or not u.shift_id:
            continue
        shift = shifts.get(u.shift_id)
        if not shift:
            continue
        for d in _daterange(b.date_start, b.date_end):
            workshop_day_absent[(shift.workshop_id, d)].append(u.qualification)

    ws_employees: dict = defaultdict(lambda: {"total": 0, "key": 0})
    for u in users.values():
        if not u.shift_id:
            continue
        shift = shifts.get(u.shift_id)
        if not shift:
            continue
        ws_employees[shift.workshop_id]["total"] += 1
        if u.qualification == "KEY":
            ws_employees[shift.workshop_id]["key"] += 1

    checked_weeks: set = set()
    for (ws_id, day), absent_quals in workshop_day_absent.items():
        week_key = (ws_id, day.isocalendar()[1], day.year)
        if week_key in checked_weeks:
            continue
        checked_weeks.add(week_key)

        period_status = SeasonStatus.NEUTRAL
        for p in periods:
            if p.date_start <= day <= p.date_end:
                period_status = SeasonStatus(p.status)
                break

        rule = rule_map.get(f"{ws_id}_{period_status.value}")
        if not rule:
            continue

        total = ws_employees[ws_id]["total"]
        key_total = ws_employees[ws_id]["key"]
        absent_count = len(absent_quals)
        absent_key = sum(1 for q in absent_quals if q == "KEY")
        present = total - absent_count
        present_key = key_total - absent_key

        ws = workshops.get(ws_id)
        ws_name = ws.name if ws else str(ws_id)
        period_str = day.strftime("неделя %W, %B %Y")

        if present < rule.min_total:
            desc = f"Присутствует {present}/{rule.min_total} сотрудников — ниже нормы"
            rec = await cached_rec("C-01", desc, ws=ws_name, period=period_str)
            conflicts.append(ConflictItem(
                code="C-01", severity="critical", description=desc,
                workshop_name=ws_name, date_start=day,
                ai_recommendation=rec,
            ))

        if present_key < rule.min_key:
            desc = f"Присутствует {present_key}/{rule.min_key} ключевых специалистов"
            rec = await cached_rec("C-02", desc, ws=ws_name, period=period_str)
            conflicts.append(ConflictItem(
                code="C-02", severity="critical", description=desc,
                workshop_name=ws_name, date_start=day,
                ai_recommendation=rec,
            ))

    return conflicts
