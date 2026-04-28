from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, require_manager
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

    # C-03: part < 14 days
    for b in blocks:
        days = (b.date_end - b.date_start).days + 1
        if days < 14:
            u = users.get(b.user_id)
            conflicts.append(ConflictItem(
                code="C-03",
                severity="critical",
                description=f"Часть отпуска {days} дн. — менее 14 дней подряд (ТК РФ ст.125)",
                employee_name=u.full_name if u else None,
                date_start=b.date_start,
                date_end=b.date_end,
            ))

    # C-05: vacation in HIGH period with quota 0
    for b in blocks:
        for p in periods:
            if p.status == SeasonStatus.HIGH and p.date_start <= b.date_end and p.date_end >= b.date_start:
                u = users.get(b.user_id)
                shift = shifts.get(u.shift_id) if u and u.shift_id else None
                rule = next(
                    (r for r in rules if r.workshop_id == shift.workshop_id and r.period_status == SeasonStatus.HIGH),
                    None
                ) if shift else None
                if rule and rule.max_on_vacation == 0:
                    conflicts.append(ConflictItem(
                        code="C-05",
                        severity="critical",
                        description="Отпуск в запрещённый HIGH-период (квота 0)",
                        employee_name=u.full_name if u else None,
                        date_start=b.date_start,
                        date_end=b.date_end,
                    ))

    # C-01/C-02: coverage per workshop per week
    # Build workshop -> rule map
    rule_map: dict[str, CoverageRule] = {}
    for r in rules:
        key = f"{r.workshop_id}_{r.period_status}"
        rule_map[key] = r

    # Build daily on-vacation set per workshop
    from collections import defaultdict
    workshop_day_absent: dict[tuple, list[str]] = defaultdict(list)  # (workshop_id, date) -> [qualification]
    for b in blocks:
        u = users.get(b.user_id)
        if not u or not u.shift_id:
            continue
        shift = shifts.get(u.shift_id)
        if not shift:
            continue
        ws_id = shift.workshop_id
        for d in _daterange(b.date_start, b.date_end):
            workshop_day_absent[(ws_id, d)].append(u.qualification)

    # Count total employees per workshop
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

        # Determine period status for this day
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

        if present < rule.min_total:
            conflicts.append(ConflictItem(
                code="C-01",
                severity="critical",
                description=f"Присутствует {present}/{rule.min_total} сотрудников — ниже нормы",
                workshop_name=ws_name,
                date_start=day,
            ))
        if present_key < rule.min_key:
            conflicts.append(ConflictItem(
                code="C-02",
                severity="critical",
                description=f"Присутствует {present_key}/{rule.min_key} ключевых специалистов",
                workshop_name=ws_name,
                date_start=day,
            ))

    return conflicts
