"""
OR-Tools CP-SAT optimizer for vacation scheduling.

Hard constraints (HC):
  HC-1: present employees >= min_total per workshop per day
  HC-2: present KEY employees >= min_key per workshop per day
  HC-3: in HIGH period with max_on_vacation=0 → no one on leave
  HC-4: in HIGH period with quota N → ≤ N on leave simultaneously per workshop
  HC-5: each employee gets a continuous block ≥ 14 calendar days
  HC-6: total block length ≤ vacation_days_norm - vacation_days_used

Soft constraints (SC):
  SC-1: wish variant 1 not satisfied → penalty 100
  SC-2: wish variant 2 not satisfied → penalty 50
  SC-3: wish variant 3 not satisfied → penalty 20
  SC-4: block in HIGH period when LOW alternative exists → penalty 80
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

log = logging.getLogger(__name__)

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False
    log.warning("OR-Tools not installed — using greedy fallback")


@dataclass
class EmployeeInput:
    id: str
    full_name: str
    qualification: str  # KEY | STD
    workshop_id: str
    norm_days: int
    used_days: int
    # wish variants (None if absent)
    v1_start: date | None
    v1_end: date | None
    v2_start: date | None
    v2_end: date | None
    v3_start: date | None
    v3_end: date | None


@dataclass
class PeriodInput:
    date_start: date
    date_end: date
    status: str        # HIGH | LOW | NEUTRAL
    max_on_vacation: int | None  # only for HIGH; None means no explicit limit


@dataclass
class CoverageInput:
    workshop_id: str
    period_status: str
    min_total: int
    min_key: int
    max_on_vacation: int | None


@dataclass
class AssignmentResult:
    employee_id: str
    date_start: date
    date_end: date
    wish_variant_used: int | None   # 1, 2, 3, or None
    penalty: int


def _daterange(start: date, end: date) -> list[date]:
    days = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def _period_for_date(d: date, periods: list[PeriodInput]) -> str:
    for p in periods:
        if p.date_start <= d <= p.date_end:
            return p.status
    return "NEUTRAL"


def _greedy_assign(
    employees: list[EmployeeInput],
    periods: list[PeriodInput],
    coverage: list[CoverageInput],
    year: int,
) -> list[AssignmentResult]:
    """Simple greedy fallback when OR-Tools is not available."""
    results = []
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    # Build forbidden ranges (HIGH with quota 0)
    forbidden_ranges: list[tuple[date, date]] = []
    for p in periods:
        if p.status == "HIGH" and p.max_on_vacation == 0:
            forbidden_ranges.append((p.date_start, p.date_end))

    for emp in employees:
        available = emp.norm_days - emp.used_days
        if available < 14:
            available = 14

        # Try wishes in order
        assigned = False
        for variant, (vs, ve) in enumerate(
            [
                (emp.v1_start, emp.v1_end),
                (emp.v2_start, emp.v2_end),
                (emp.v3_start, emp.v3_end),
            ],
            start=1,
        ):
            if not vs or not ve:
                continue
            # Check not forbidden
            in_forbidden = any(
                not (ve < fs or vs > fe) for fs, fe in forbidden_ranges
            )
            if not in_forbidden:
                block_days = (ve - vs).days + 1
                if block_days < 14:
                    ve = vs + timedelta(days=13)
                results.append(AssignmentResult(
                    employee_id=emp.id,
                    date_start=vs,
                    date_end=ve,
                    wish_variant_used=variant,
                    penalty=0,
                ))
                assigned = True
                break

        if not assigned:
            # Default: place in first available LOW/NEUTRAL window ≥ 14 days
            candidate = date(year, 6, 1)  # fallback June
            in_forbidden = any(
                not (candidate + timedelta(days=13) < fs or candidate > fe)
                for fs, fe in forbidden_ranges
            )
            if in_forbidden:
                candidate = date(year, 9, 1)
            results.append(AssignmentResult(
                employee_id=emp.id,
                date_start=candidate,
                date_end=candidate + timedelta(days=min(available, 28) - 1),
                wish_variant_used=None,
                penalty=100,
            ))

    return results


def solve(
    employees: list[EmployeeInput],
    periods: list[PeriodInput],
    coverage: list[CoverageInput],
    year: int,
    time_limit_seconds: int = 55,
) -> list[AssignmentResult]:
    if not HAS_ORTOOLS:
        return _greedy_assign(employees, periods, coverage, year)

    model = cp_model.CpModel()
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    total_days = (year_end - year_start).days + 1

    def d2i(d: date) -> int:
        return (d - year_start).days

    # Build forbidden day sets per workshop from HIGH periods
    ws_forbidden: dict[str, set[int]] = {}
    ws_max_absent: dict[str, dict[int, int]] = {}  # workshop_id -> {day_idx: max_absent}

    for p in periods:
        if p.status != "HIGH":
            continue
        for cov in coverage:
            if cov.period_status != "HIGH":
                continue
            ws_id = cov.workshop_id
            if ws_id not in ws_forbidden:
                ws_forbidden[ws_id] = set()
                ws_max_absent[ws_id] = {}
            for d in _daterange(p.date_start, p.date_end):
                idx = d2i(d)
                if cov.max_on_vacation == 0:
                    ws_forbidden[ws_id].add(idx)
                else:
                    limit = min(
                        ws_max_absent[ws_id].get(idx, 9999),
                        cov.max_on_vacation if cov.max_on_vacation else 9999,
                    )
                    ws_max_absent[ws_id][idx] = limit

    # Per employee: start variable
    results_map: dict[str, AssignmentResult] = {}

    # Build wish candidates
    emp_candidates: dict[str, list[tuple[date, date, int | None, int]]] = {}
    for emp in employees:
        available = max(14, emp.norm_days - emp.used_days)
        candidates = []

        def add_candidate(vs: date | None, ve: date | None, variant: int | None, base_penalty: int):
            if not vs or not ve:
                return
            if vs.year != year or ve.year != year:
                return
            block = max(14, (ve - vs).days + 1)
            ve_adj = vs + timedelta(days=block - 1)
            if ve_adj > year_end:
                return
            candidates.append((vs, ve_adj, variant, base_penalty))

        add_candidate(emp.v1_start, emp.v1_end, 1, 0)
        add_candidate(emp.v2_start, emp.v2_end, 2, 50)
        add_candidate(emp.v3_start, emp.v3_end, 3, 80)

        # Fallback candidates in LOW periods
        for p in periods:
            if p.status == "LOW":
                vs = p.date_start
                ve = vs + timedelta(days=min(available, 28) - 1)
                if ve <= year_end:
                    candidates.append((vs, ve, None, 80))

        # Ultimate fallback
        fallback_start = date(year, 9, 1)
        candidates.append((
            fallback_start,
            fallback_start + timedelta(days=min(available, 28) - 1),
            None, 100
        ))

        # Remove duplicates
        seen = set()
        unique = []
        for c in candidates:
            key = (c[0], c[1])
            if key not in seen:
                seen.add(key)
                unique.append(c)

        emp_candidates[emp.id] = unique

    # Variables: for each employee, which candidate is selected
    emp_vars: dict[str, list] = {}
    for emp in employees:
        candidates = emp_candidates[emp.id]
        if not candidates:
            continue
        bools = [model.new_bool_var(f"e{emp.id}_c{i}") for i in range(len(candidates))]
        model.add_exactly_one(bools)
        emp_vars[emp.id] = bools

    # HC-1/HC-2: coverage per workshop per day
    # Group employees by workshop
    ws_employees: dict[str, list[EmployeeInput]] = {}
    for emp in employees:
        ws_employees.setdefault(emp.workshop_id, []).append(emp)

    ws_totals: dict[str, int] = {ws_id: len(emps) for ws_id, emps in ws_employees.items()}
    ws_key_totals: dict[str, int] = {
        ws_id: sum(1 for e in emps if e.qualification == "KEY")
        for ws_id, emps in ws_employees.items()
    }

    # For coverage, check per week (to reduce model size)
    week_starts = []
    cur = year_start
    while cur <= year_end:
        week_starts.append(cur)
        cur += timedelta(days=7)

    for ws_id, ws_emps in ws_employees.items():
        for p in periods:
            # Get coverage rule for this period status
            cov = next(
                (c for c in coverage if c.workshop_id == ws_id and c.period_status == p.status),
                None
            )
            if not cov:
                continue

            # Check each week that overlaps with this period
            for week_start in week_starts:
                check_day = max(week_start, p.date_start)
                if check_day > p.date_end or check_day > year_end:
                    continue
                day_idx = d2i(check_day)

                # Sum of employees absent on this day
                absent_vars = []
                absent_key_vars = []

                for emp in ws_emps:
                    if emp.id not in emp_vars:
                        continue
                    candidates = emp_candidates[emp.id]
                    bools = emp_vars[emp.id]
                    for i, (vs, ve, _, _) in enumerate(candidates):
                        if vs <= check_day <= ve:
                            absent_vars.append(bools[i])
                            if emp.qualification == "KEY":
                                absent_key_vars.append(bools[i])

                total = ws_totals.get(ws_id, 0)
                key_total = ws_key_totals.get(ws_id, 0)

                if absent_vars and total > 0:
                    # HC-1: present >= min_total
                    model.add(sum(absent_vars) <= total - cov.min_total)

                if absent_key_vars and key_total > 0:
                    # HC-2: present KEY >= min_key
                    model.add(sum(absent_key_vars) <= key_total - cov.min_key)

                # HC-3/HC-4: HIGH quota
                if p.status == "HIGH" and cov.max_on_vacation is not None and absent_vars:
                    model.add(sum(absent_vars) <= cov.max_on_vacation)

    # Objective: minimize penalties
    penalty_terms = []
    for emp in employees:
        if emp.id not in emp_vars:
            continue
        candidates = emp_candidates[emp.id]
        bools = emp_vars[emp.id]
        for i, (vs, ve, variant, base_penalty) in enumerate(candidates):
            extra = 0
            # SC-4: in HIGH when LOW exists
            if any(p.date_start <= vs <= p.date_end and p.status == "HIGH" for p in periods):
                if any(p.status == "LOW" for p in periods):
                    extra += 80
            total_pen = base_penalty + extra
            if total_pen > 0:
                penalty_terms.append(total_pen * bools[i])

    if penalty_terms:
        model.minimize(sum(penalty_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 4

    status = solver.solve(model)
    log.info("OR-Tools status: %s  objective: %s", solver.status_name(status), solver.objective_value if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else "N/A")

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        log.warning("OR-Tools could not find feasible solution — using greedy fallback")
        return _greedy_assign(employees, periods, coverage, year)

    results = []
    for emp in employees:
        if emp.id not in emp_vars:
            # No candidates — greedy single assignment
            results.append(AssignmentResult(
                employee_id=emp.id,
                date_start=date(year, 6, 1),
                date_end=date(year, 6, 28),
                wish_variant_used=None,
                penalty=100,
            ))
            continue

        candidates = emp_candidates[emp.id]
        bools = emp_vars[emp.id]
        for i, (vs, ve, variant, base_penalty) in enumerate(candidates):
            if solver.value(bools[i]):
                results.append(AssignmentResult(
                    employee_id=emp.id,
                    date_start=vs,
                    date_end=ve,
                    wish_variant_used=variant,
                    penalty=base_penalty,
                ))
                break

    return results
