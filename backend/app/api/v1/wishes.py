import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db, require_manager
from app.models.models import SeasonPeriod, SeasonStatus, User, WishRequest
from app.schemas.schemas import WishRequestResponse, WishRequestUpdate, WishRequestWithUser

router = APIRouter(prefix="/wishes", tags=["wishes"])


def _days(start: date | None, end: date | None) -> int:
    if start and end and end >= start:
        return (end - start).days + 1
    return 0


def _check_season(start: date | None, end: date | None, periods: list[SeasonPeriod]) -> str | None:
    if not start or not end:
        return None
    for p in periods:
        if p.date_start <= end and p.date_end >= start:
            if p.status == SeasonStatus.HIGH:
                return "high"
    return None


@router.get("/my", response_model=WishRequestResponse)
async def get_my_wishes(
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WishRequest)
        .where(WishRequest.user_id == current_user.id, WishRequest.year == year)
    )
    wish = result.scalar_one_or_none()
    if not wish:
        wish = WishRequest(user_id=current_user.id, year=year)
        db.add(wish)
        await db.commit()
        await db.refresh(wish)
    return wish


@router.put("/my", response_model=WishRequestResponse)
async def save_my_wishes(
    year: int = Query(...),
    body: WishRequestUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WishRequest)
        .where(WishRequest.user_id == current_user.id, WishRequest.year == year)
    )
    wish = result.scalar_one_or_none()
    if not wish:
        wish = WishRequest(user_id=current_user.id, year=year)
        db.add(wish)

    if wish.is_locked:
        raise HTTPException(403, "Пожелания заблокированы: генерация уже запущена")

    # Варианты — альтернативные (выбирается один), поэтому каждый проверяем отдельно
    available = current_user.vacation_days_norm - current_user.vacation_days_used
    for var_start, var_end, label in [
        (body.v1_start, body.v1_end, "Вариант 1"),
        (body.v2_start, body.v2_end, "Вариант 2"),
        (body.v3_start, body.v3_end, "Вариант 3"),
    ]:
        days = _days(var_start, var_end)
        if days > 0 and days > available:
            raise HTTPException(
                400,
                f"{label}: запрошено {days} дн., доступно {available} дн."
            )

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(wish, k, v)
    await db.commit()
    await db.refresh(wish)
    return wish


@router.get("", response_model=list[WishRequestWithUser])
async def list_all_wishes(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    result = await db.execute(
        select(WishRequest).where(WishRequest.year == year)
    )
    wishes = result.scalars().all()
    out = []
    for w in wishes:
        user = await db.get(User, w.user_id)
        from app.schemas.schemas import UserResponse
        out.append(WishRequestWithUser(
            **WishRequestResponse.model_validate(w).model_dump(),
            user=UserResponse.model_validate(user),
        ))
    return out
