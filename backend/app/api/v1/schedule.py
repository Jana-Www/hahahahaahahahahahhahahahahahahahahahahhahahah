"""Schedule generation endpoint — runs OR-Tools CP-SAT in a BackgroundTask."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.deps import get_db, require_manager
from app.llm.explainer import generate_explanation
from app.models.models import (
    CoverageRule, GenerationJob, JobStatus, SeasonPeriod,
    Shift, User, VacationBlock, VacationStatus, WishRequest,
)
from app.optimizer.solver import (
    CoverageInput, EmployeeInput, PeriodInput, solve,
)
from app.schemas.schemas import GenerationJobResponse

log = logging.getLogger(__name__)
router = APIRouter(prefix="/schedule", tags=["schedule"])


async def _unlock_wishes_for_year(db: AsyncSession, year: int) -> None:
    wishes_res = await db.execute(select(WishRequest).where(WishRequest.year == year))
    for w in wishes_res.scalars().all():
        w.is_locked = False


async def _delete_non_approved_blocks(db: AsyncSession, year: int) -> None:
    await db.execute(
        delete(VacationBlock).where(
            VacationBlock.year == year,
            VacationBlock.status != VacationStatus.APPROVED.value,
        )
    )


async def _abort_generation_if_cancelled(db: AsyncSession, job_id, year: int) -> bool:
    """Если задача отменена менеджером — снимаем блокировку пожеланий и коммитим. True = выходим без сохранения графика."""
    job = await db.get(GenerationJob, job_id)
    if not job:
        return True
    await db.refresh(job)
    if job.status != JobStatus.CANCELLED:
        return False
    await _unlock_wishes_for_year(db, year)
    await db.commit()
    log.info("Generation job %s cancelled — unlocked wishes", job_id)
    return True


async def _run_generation(year: int, job_id, db_url: str):
    """Background task: run optimizer and persist results."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession as AS

    engine = create_async_engine(db_url, echo=False)
    Session = async_sessionmaker(engine, class_=AS, expire_on_commit=False)

    try:
        async with Session() as db:
            job = await db.get(GenerationJob, job_id)
            if not job:
                return
            await db.refresh(job)
            if job.status != JobStatus.RUNNING:
                return

            try:
                # Load data
                users_res = await db.execute(select(User))
                users = users_res.scalars().all()

                wishes_res = await db.execute(select(WishRequest).where(WishRequest.year == year))
                wishes_map = {w.user_id: w for w in wishes_res.scalars().all()}

                shifts_res = await db.execute(select(Shift))
                shifts_map = {s.id: s for s in shifts_res.scalars().all()}

                periods_res = await db.execute(select(SeasonPeriod).where(SeasonPeriod.year == year))
                periods = periods_res.scalars().all()

                rules_res = await db.execute(select(CoverageRule))
                rules = rules_res.scalars().all()

                # Build optimizer inputs
                emp_inputs = []
                for u in users:
                    if not u.shift_id:
                        continue
                    shift = shifts_map.get(u.shift_id)
                    if not shift:
                        continue
                    wish = wishes_map.get(u.id)
                    emp_inputs.append(EmployeeInput(
                        id=str(u.id),
                        full_name=u.full_name,
                        qualification=u.qualification,
                        workshop_id=str(shift.workshop_id),
                        norm_days=u.vacation_days_norm,
                        used_days=u.vacation_days_used,
                        v1_start=wish.v1_start if wish else None,
                        v1_end=wish.v1_end if wish else None,
                        v2_start=wish.v2_start if wish else None,
                        v2_end=wish.v2_end if wish else None,
                        v3_start=wish.v3_start if wish else None,
                        v3_end=wish.v3_end if wish else None,
                    ))

                period_inputs = [
                    PeriodInput(
                        date_start=p.date_start,
                        date_end=p.date_end,
                        status=p.status,
                        max_on_vacation=None,
                    )
                    for p in periods
                ]

                coverage_inputs = [
                    CoverageInput(
                        workshop_id=str(r.workshop_id),
                        period_status=r.period_status,
                        min_total=r.min_total,
                        min_key=r.min_key,
                        max_on_vacation=r.max_on_vacation,
                    )
                    for r in rules
                ]

                await db.refresh(job)
                if job.status != JobStatus.RUNNING:
                    return

                # Lock wish requests
                for w in wishes_map.values():
                    w.is_locked = True
                await db.flush()

                if await _abort_generation_if_cancelled(db, job_id, year):
                    return

                # Solve
                results = solve(emp_inputs, period_inputs, coverage_inputs, year)

                if await _abort_generation_if_cancelled(db, job_id, year):
                    return

                # Persist vacation blocks
                import uuid as _uuid
                users_map = {str(u.id): u for u in users}
                wishes_orig = {str(u_id): w for u_id, w in wishes_map.items()}

                for res in results:
                    u = users_map.get(res.employee_id)
                    if not u:
                        continue

                    # Check if wish #1 was not satisfied → generate LLM explanation
                    explanation = None
                    wish = wishes_orig.get(res.employee_id)
                    if wish and res.wish_variant_used != 1 and wish.v1_start and wish.v1_end:
                        reason = "производственные ограничения и нормы покрытия цеха не позволяют одобрить запрошенный период"
                        explanation = await generate_explanation(
                            employee_name=u.full_name,
                            wish_start=wish.v1_start,
                            wish_end=wish.v1_end,
                            assigned_start=res.date_start,
                            assigned_end=res.date_end,
                            reason=reason,
                            api_key=settings.OPENAI_API_KEY,
                            model=settings.OPENAI_MODEL,
                            base_url=settings.OPENAI_BASE_URL,
                        )

                    # Upsert vacation block
                    existing_res = await db.execute(
                        select(VacationBlock).where(
                            VacationBlock.user_id == u.id,
                            VacationBlock.year == year,
                        )
                    )
                    existing = existing_res.scalar_one_or_none()
                    if existing:
                        existing.date_start = res.date_start
                        existing.date_end = res.date_end
                        existing.status = VacationStatus.DRAFT
                        existing.wish_variant_used = res.wish_variant_used
                        existing.ai_explanation = explanation
                        existing.manager_comment = None
                    else:
                        block = VacationBlock(
                            id=_uuid.uuid4(),
                            user_id=u.id,
                            year=year,
                            date_start=res.date_start,
                            date_end=res.date_end,
                            status=VacationStatus.DRAFT,
                            wish_variant_used=res.wish_variant_used,
                            ai_explanation=explanation,
                        )
                        db.add(block)

                job = await db.get(GenerationJob, job_id)
                if job:
                    await db.refresh(job)
                    if job.status == JobStatus.CANCELLED:
                        await db.rollback()
                        log.info(
                            "Generation job %s cancelled after solver output — discarded draft blocks",
                            job_id,
                        )
                        return

                job.status = JobStatus.DONE
                job.finished_at = datetime.now(timezone.utc)
                await db.commit()
                log.info("Generation job %s finished successfully", job_id)

            except Exception as e:
                log.exception("Generation job %s failed: %s", job_id, e)
                job = await db.get(GenerationJob, job_id)
                if job:
                    await db.refresh(job)
                    if job.status != JobStatus.CANCELLED:
                        job.status = JobStatus.FAILED
                        job.error_message = str(e)
                        job.finished_at = datetime.now(timezone.utc)
                        await db.commit()
    finally:
        await engine.dispose()


@router.post("/generate", response_model=GenerationJobResponse, status_code=202)
async def generate_schedule(
    year: int = Query(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    # Check not already running
    running_res = await db.execute(
        select(GenerationJob).where(
            GenerationJob.year == year,
            GenerationJob.status == JobStatus.RUNNING,
        )
    )
    if running_res.scalar_one_or_none():
        raise HTTPException(409, "Генерация уже запущена для этого года")

    job = GenerationJob(year=year, status=JobStatus.RUNNING)
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(_run_generation, year, job.id, settings.DATABASE_URL)
    return job


@router.post("/cancel", response_model=GenerationJobResponse)
async def cancel_schedule(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    """Отменить идущую генерацию или снять сгенерированный черновик графика (не затрагивает утверждённые блоки)."""
    result = await db.execute(
        select(GenerationJob)
        .where(GenerationJob.year == year)
        .order_by(GenerationJob.started_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Нет записи о генерации для этого года")

    now = datetime.now(timezone.utc)

    if job.status == JobStatus.RUNNING:
        job.status = JobStatus.CANCELLED
        job.finished_at = now
        job.error_message = None
        await db.commit()
        await db.refresh(job)
        return job

    await _delete_non_approved_blocks(db, year)
    await _unlock_wishes_for_year(db, year)
    job.status = JobStatus.CANCELLED
    job.finished_at = job.finished_at or now
    job.error_message = None
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/status", response_model=GenerationJobResponse | None)
async def get_schedule_status(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    result = await db.execute(
        select(GenerationJob)
        .where(GenerationJob.year == year)
        .order_by(GenerationJob.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
