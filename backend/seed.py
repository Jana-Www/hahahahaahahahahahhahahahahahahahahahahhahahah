"""
Demo data seed script.
Run inside the backend container:
  docker compose exec backend python seed.py
"""

import asyncio
import os
import random
from datetime import date, datetime

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.core.database import Base
from app.core.security import get_password_hash
from app.models.models import (
    CoverageRule, GenerationJob, SeasonPeriod,
    Shift, User, VacationBlock, WishRequest, Workshop,
)

YEAR = 2026

WORKSHOPS = [
    "Цех №1 (Ферментация)",
    "Цех №2 (Очистка)",
    "Цех №3 (Розлив)",
    "Цех №4 (Упаковка)",
    "Цех №5 (Контроль качества)",
    "Цех №6 (Техническое обслуживание)",
    "Цех №7 (Склад)",
]

SHIFTS = ["Первая смена", "Вторая смена", "Третья смена", "Круглосуточная"]

FIRST_NAMES = [
    "Александр", "Михаил", "Дмитрий", "Сергей", "Андрей", "Алексей", "Иван", "Николай",
    "Денис", "Артём", "Анна", "Мария", "Елена", "Ольга", "Наталья", "Татьяна", "Светлана",
    "Юлия", "Екатерина", "Ирина", "Владимир", "Евгений", "Роман", "Кирилл", "Павел",
]

LAST_NAMES = [
    "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов",
    "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров",
    "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев", "Макаров", "Никитин",
]

POSITIONS = [
    "Оператор", "Старший оператор", "Технолог", "Инженер", "Мастер смены",
    "Лаборант", "Механик", "Контролёр", "Наладчик", "Кладовщик",
]

# Праздники РФ 2026
RF_HOLIDAYS_2026 = [
    date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3), date(2026, 1, 4),
    date(2026, 1, 5), date(2026, 1, 6), date(2026, 1, 7), date(2026, 1, 8),
    date(2026, 2, 23), date(2026, 3, 8), date(2026, 3, 9),
    date(2026, 5, 1), date(2026, 5, 4), date(2026, 5, 9),
    date(2026, 6, 12), date(2026, 11, 4),
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with Session() as db:
        print("Seeding workshops and shifts...")
        workshops = []
        shifts_all = []

        for ws_name in WORKSHOPS:
            ws = Workshop(name=ws_name)
            db.add(ws)
            await db.flush()
            workshops.append(ws)

            for sh_name in SHIFTS[:3]:  # 3 shifts per workshop
                sh = Shift(name=sh_name, workshop_id=ws.id)
                db.add(sh)
                await db.flush()
                shifts_all.append(sh)

        print(f"Created {len(workshops)} workshops, {len(shifts_all)} shifts")

        # Manager
        manager = User(
            full_name="Менеджер Системный",
            login="manager",
            password_hash=get_password_hash("manager123"),
            role="MANAGER",
            position="HR-менеджер",
            qualification="KEY",
            shift_id=shifts_all[0].id,
            vacation_days_norm=28,
            vacation_days_used=0,
        )
        db.add(manager)

        # 50 employees
        print("Seeding 50 employees...")
        employees = []
        random.seed(42)
        used_logins = {"manager"}

        for i in range(50):
            fn = random.choice(FIRST_NAMES)
            ln = random.choice(LAST_NAMES)
            full_name = f"{ln} {fn[0]}."
            base_login = f"{fn.lower()[:4]}{ln.lower()[:4]}{i}"
            login = base_login
            while login in used_logins:
                login = f"{base_login}_{random.randint(1,99)}"
            used_logins.add(login)

            shift = shifts_all[i % len(shifts_all)]
            qual = "KEY" if i % 5 == 0 else "STD"

            emp = User(
                full_name=f"{ln} {fn}",
                login=login,
                password_hash=get_password_hash("password123"),
                role="EMPLOYEE",
                position=random.choice(POSITIONS),
                line_text=f"Линия {random.randint(1, 4)}",
                qualification=qual,
                shift_id=shift.id,
                vacation_days_norm=28,
                vacation_days_used=random.choice([0, 0, 0, 7, 14]),
            )
            db.add(emp)
            await db.flush()
            employees.append(emp)

        print(f"Created {len(employees)} employees")

        # Season periods
        print("Seeding season periods...")
        season_periods = [
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 1, 1), date_end=date(YEAR, 1, 31), status="NEUTRAL"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 2, 1), date_end=date(YEAR, 2, 28), status="LOW"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 3, 1), date_end=date(YEAR, 3, 31), status="LOW"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 4, 1), date_end=date(YEAR, 4, 30), status="NEUTRAL"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 5, 1), date_end=date(YEAR, 5, 31), status="HIGH"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 6, 1), date_end=date(YEAR, 6, 30), status="HIGH"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 7, 1), date_end=date(YEAR, 7, 31), status="LOW"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 8, 1), date_end=date(YEAR, 8, 31), status="LOW"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 9, 1), date_end=date(YEAR, 9, 30), status="NEUTRAL"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 10, 1), date_end=date(YEAR, 10, 31), status="NEUTRAL"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 11, 1), date_end=date(YEAR, 11, 30), status="HIGH"),
            SeasonPeriod(year=YEAR, date_start=date(YEAR, 12, 1), date_end=date(YEAR, 12, 31), status="HIGH"),
        ]
        for sp in season_periods:
            db.add(sp)

        # Coverage rules per workshop
        print("Seeding coverage rules...")
        for ws in workshops:
            for status, min_total, min_key, max_vac in [
                ("HIGH",    6, 2, 2),
                ("LOW",     3, 1, None),
                ("NEUTRAL", 4, 1, None),
            ]:
                rule = CoverageRule(
                    workshop_id=ws.id,
                    period_status=status,
                    min_total=min_total,
                    min_key=min_key,
                    max_on_vacation=max_vac,
                )
                db.add(rule)

        await db.flush()

        # Wish requests
        print("Seeding wish requests...")
        wish_pools = [
            # LOW/NEUTRAL preferred
            [(date(YEAR, 2, 10), date(YEAR, 2, 24)), (date(YEAR, 3, 5), date(YEAR, 3, 19)), (date(YEAR, 8, 1), date(YEAR, 8, 15))],
            [(date(YEAR, 7, 15), date(YEAR, 7, 29)), (date(YEAR, 8, 5), date(YEAR, 8, 19)), (date(YEAR, 2, 1), date(YEAR, 2, 15))],
            [(date(YEAR, 3, 1), date(YEAR, 3, 15)), (date(YEAR, 7, 1), date(YEAR, 7, 15)), (date(YEAR, 9, 1), date(YEAR, 9, 15))],
            [(date(YEAR, 8, 10), date(YEAR, 8, 24)), (date(YEAR, 2, 15), date(YEAR, 3, 1)), (date(YEAR, 7, 20), date(YEAR, 8, 3))],
            [(date(YEAR, 7, 5), date(YEAR, 7, 19)), (date(YEAR, 8, 20), date(YEAR, 9, 3)), (date(YEAR, 3, 10), date(YEAR, 3, 24))],
            # Some employees request HIGH season (conflict scenarios)
            [(date(YEAR, 5, 10), date(YEAR, 5, 24)), (date(YEAR, 7, 1), date(YEAR, 7, 15)), (date(YEAR, 2, 1), date(YEAR, 2, 15))],
            [(date(YEAR, 6, 1), date(YEAR, 6, 15)), (date(YEAR, 8, 1), date(YEAR, 8, 15)), (date(YEAR, 3, 1), date(YEAR, 3, 15))],
        ]

        for i, emp in enumerate(employees):
            pool = wish_pools[i % len(wish_pools)]
            v1, v2, v3 = pool[0], pool[1], pool[2]
            wish = WishRequest(
                user_id=emp.id,
                year=YEAR,
                is_locked=False,
                v1_start=v1[0], v1_end=v1[1], v1_comment=random.choice([None, "Семейные обстоятельства", "Путешествие", "Ремонт"]),
                v2_start=v2[0], v2_end=v2[1], v2_comment=None,
                v3_start=v3[0], v3_end=v3[1], v3_comment=None,
            )
            db.add(wish)

        await db.commit()
        print("\n✅ Seed complete!")
        print(f"   Workshops: {len(workshops)}")
        print(f"   Shifts: {len(shifts_all)}")
        print(f"   Employees: {len(employees)}")
        print(f"   Manager login: manager / manager123")
        print(f"   Employee login example: {employees[0].login} / password123")
        print(f"   Season periods: {len(season_periods)}")
        print(f"   Coverage rules: {len(workshops) * 3}")
        print(f"   Wish requests: {len(employees)}")

        # Regenerate BD.md
        await write_bd_md(db, employees, workshops, shifts_all, season_periods)

    await engine.dispose()


async def write_bd_md(db, employees, workshops, shifts_all, season_periods):
    """Generate and write BD.md to the project root (/workspace/BD.md)."""
    today = datetime.now().strftime("%d %B %Y")

    # Build employee rows
    emp_rows = []
    for emp in employees:
        shift = next((s for s in shifts_all if s.id == emp.shift_id), None)
        ws = next((w for w in workshops if shift and w.id == shift.workshop_id), None)
        emp_rows.append(
            f"| {emp.full_name} | `{emp.login}` | EMPLOYEE | {emp.qualification} | "
            f"{ws.name if ws else '—'} | {shift.name if shift else '—'} |"
        )

    emp_table = "\n".join(sorted(emp_rows))

    season_map = {"HIGH": "HIGH (высокий) 🔴", "LOW": "LOW (низкий)", "NEUTRAL": "NEUTRAL (нейтральный)"}
    season_rows = "\n".join(
        f"| {p.date_start.strftime('%d.%m')} — {p.date_end.strftime('%d.%m')} | {season_map.get(p.status, p.status)} |"
        for p in sorted(season_periods, key=lambda x: x.date_start)
    )

    content = f"""# BD.md — Содержимое базы данных

> Актуально на: **{today}**
> БД: `vacation_planner` (PostgreSQL 16)
> Обновляется автоматически при запуске `seed.py`.

---

## Учётные данные для входа

| Роль | Логин | Пароль |
|------|-------|--------|
| Менеджер | `manager` | `manager123` |
| Любой сотрудник | см. таблицу ниже | `password123` |

---

## Цеха и смены ({len(workshops)} цехов, {len(shifts_all)} смен)

| Цех | Смены |
|-----|-------|
{chr(10).join(f"| {ws.name} | Первая смена, Вторая смена, Третья смена |" for ws in workshops)}

---

## Сотрудники ({len(employees)} чел. + 1 менеджер)

Пароль для всех сотрудников: `password123`

| ФИО | Логин | Роль | Квалификация | Цех | Смена |
|-----|-------|------|-------------|-----|-------|
| Менеджер Системный | `manager` | MANAGER | KEY | {workshops[0].name} | {shifts_all[0].name} |
{emp_table}

> **KEY** — ключевой специалист, **STD** — стандартный сотрудник

---

## Сезонные периоды {YEAR}

| Период | Статус |
|--------|--------|
{season_rows}

---

## Нормы покрытия (одинаковы для всех {len(workshops)} цехов)

| Период | Мин. присутствующих | Мин. ключевых | Макс. в отпуске |
|--------|---------------------|---------------|-----------------|
| HIGH | 6 | 2 | 2 |
| NEUTRAL | 4 | 1 | — |
| LOW | 3 | 1 | — |

---

## Структура таблиц БД

| Таблица | Описание | Записей |
|---------|----------|---------|
| `users` | Пользователи (менеджер + сотрудники) | {len(employees) + 1} |
| `workshops` | Цеха | {len(workshops)} |
| `shifts` | Смены | {len(shifts_all)} |
| `season_periods` | Сезонные периоды | {len(season_periods)} |
| `coverage_rules` | Нормы покрытия | {len(workshops) * 3} |
| `wish_requests` | Пожелания сотрудников | {len(employees)} |
| `vacation_blocks` | Отпускные блоки (результат генерации) | генерируется |
| `generation_jobs` | История запусков генерации | — |
"""

    # Write to /app/BD.md (backend mount = ./backend on host)
    # A post-seed script copies it to the project root automatically
    bd_path = "/app/BD.md"
    with open(bd_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"   BD.md written to {bd_path}")


if __name__ == "__main__":
    asyncio.run(seed())
