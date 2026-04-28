import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db, require_manager
from app.models.models import SeasonPeriod
from app.schemas.schemas import SeasonPeriodCreate, SeasonPeriodResponse, SeasonPeriodUpdate

router = APIRouter(prefix="/season-periods", tags=["season-periods"])


@router.get("", response_model=list[SeasonPeriodResponse])
async def list_season_periods(
    year: int = Query(..., description="Год планирования"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(SeasonPeriod)
        .where(SeasonPeriod.year == year)
        .order_by(SeasonPeriod.date_start)
    )
    return result.scalars().all()


@router.post("", response_model=SeasonPeriodResponse, status_code=201)
async def create_season_period(
    body: SeasonPeriodCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    period = SeasonPeriod(
        year=body.year,
        date_start=body.date_start,
        date_end=body.date_end,
        status=body.status.value,
    )
    db.add(period)
    await db.commit()
    await db.refresh(period)
    return period


@router.put("/{period_id}", response_model=SeasonPeriodResponse)
async def update_season_period(
    period_id: uuid.UUID,
    body: SeasonPeriodUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    period = await db.get(SeasonPeriod, period_id)
    if not period:
        raise HTTPException(404, "Период не найден")
    data = body.model_dump(exclude_unset=True)
    if "status" in data and hasattr(data["status"], "value"):
        data["status"] = data["status"].value
    for k, v in data.items():
        setattr(period, k, v)
    await db.commit()
    await db.refresh(period)
    return period


@router.delete("/{period_id}", status_code=204)
async def delete_season_period(
    period_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    period = await db.get(SeasonPeriod, period_id)
    if not period:
        raise HTTPException(404, "Период не найден")
    await db.delete(period)
    await db.commit()
