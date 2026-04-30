from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, require_manager
from app.models.models import User, UserRole, VacationBlock, VacationStatus, WishRequest
from app.schemas.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
async def get_dashboard(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    employees_res = await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.EMPLOYEE.value)
    )
    total_employees = employees_res.scalar() or 0

    blocks_res = await db.execute(
        select(VacationBlock)
        .join(User, User.id == VacationBlock.user_id)
        .where(
            VacationBlock.year == year,
            User.role == UserRole.EMPLOYEE.value,
        )
    )
    blocks = blocks_res.scalars().all()

    status_counts = {s.value: 0 for s in VacationStatus}
    for b in blocks:
        status_counts[b.status] = status_counts.get(b.status, 0) + 1

    wished_employees_res = await db.execute(
        select(func.count(func.distinct(WishRequest.user_id)))
        .join(User, User.id == WishRequest.user_id)
        .where(
            WishRequest.year == year,
            User.role == UserRole.EMPLOYEE.value,
        )
    )
    wished_employees = wished_employees_res.scalar() or 0

    return DashboardStats(
        total_employees=total_employees,
        approved=status_counts.get(VacationStatus.APPROVED.value, 0),
        pending=status_counts.get(VacationStatus.PENDING.value, 0),
        draft=status_counts.get(VacationStatus.DRAFT.value, 0),
        conflict=status_counts.get(VacationStatus.CONFLICT.value, 0),
        modified=status_counts.get(VacationStatus.MODIFIED.value, 0),
        without_wishes=max(0, total_employees - wished_employees),
    )
