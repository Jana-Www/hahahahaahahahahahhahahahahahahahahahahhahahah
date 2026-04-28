from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, require_manager
from app.models.models import User, VacationBlock, VacationStatus, WishRequest
from app.schemas.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
async def get_dashboard(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    users_res = await db.execute(select(func.count()).select_from(User))
    total = users_res.scalar() or 0

    blocks_res = await db.execute(select(VacationBlock).where(VacationBlock.year == year))
    blocks = blocks_res.scalars().all()

    status_counts = {s.value: 0 for s in VacationStatus}
    for b in blocks:
        status_counts[b.status] = status_counts.get(b.status, 0) + 1

    wishes_res = await db.execute(select(WishRequest).where(WishRequest.year == year))
    wishes_count = len(wishes_res.scalars().all())

    return DashboardStats(
        total_employees=total,
        approved=status_counts.get(VacationStatus.APPROVED, 0),
        pending=status_counts.get(VacationStatus.PENDING, 0),
        draft=status_counts.get(VacationStatus.DRAFT, 0),
        conflict=status_counts.get(VacationStatus.CONFLICT, 0),
        modified=status_counts.get(VacationStatus.MODIFIED, 0),
        without_wishes=max(0, total - wishes_count),
    )
