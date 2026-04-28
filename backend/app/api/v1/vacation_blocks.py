import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db, require_manager
from app.models.models import CoverageRule, User, VacationBlock, VacationStatus
from app.schemas.schemas import UserResponse, VacationBlockResponse, VacationBlockUpdate, VacationBlockWithUser

router = APIRouter(prefix="/vacation-blocks", tags=["vacation-blocks"])


def _validate_tk(date_start: date, date_end: date):
    days = (date_end - date_start).days + 1
    if days < 14:
        raise HTTPException(
            400,
            f"Продолжительность отпуска {days} дн. — минимум 14 календарных дней подряд (ст. 125 ТК РФ)"
        )


@router.get("", response_model=list[VacationBlockWithUser])
async def list_vacation_blocks(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    result = await db.execute(
        select(VacationBlock).where(VacationBlock.year == year)
    )
    blocks = result.scalars().all()
    out = []
    for b in blocks:
        user = await db.get(User, b.user_id)
        out.append(VacationBlockWithUser(
            **VacationBlockResponse.model_validate(b).model_dump(),
            user=UserResponse.model_validate(user),
        ))
    return out


@router.get("/my", response_model=VacationBlockResponse | None)
async def get_my_block(
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VacationBlock).where(
            VacationBlock.user_id == current_user.id,
            VacationBlock.year == year,
        )
    )
    return result.scalar_one_or_none()


@router.put("/{block_id}", response_model=VacationBlockResponse)
async def update_vacation_block(
    block_id: uuid.UUID,
    body: VacationBlockUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    block = await db.get(VacationBlock, block_id)
    if not block:
        raise HTTPException(404, "Отпускной блок не найден")

    if body.date_start is not None and body.date_end is not None:
        _validate_tk(body.date_start, body.date_end)
    elif body.date_start is not None:
        _validate_tk(body.date_start, block.date_end)
    elif body.date_end is not None:
        _validate_tk(block.date_start, body.date_end)

    data = body.model_dump(exclude_unset=True)
    if "status" in data and hasattr(data["status"], "value"):
        data["status"] = data["status"].value
    for k, v in data.items():
        setattr(block, k, v)

    await db.commit()
    await db.refresh(block)
    return block
