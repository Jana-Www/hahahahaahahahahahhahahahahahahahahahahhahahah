import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.deps import get_current_user, get_db, require_manager
from app.models.models import User
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    result = await db.execute(select(User).order_by(User.full_name))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    user = User(
        full_name=body.full_name,
        login=body.login,
        password_hash=get_password_hash(body.password),
        role=body.role.value,
        position=body.position,
        line_text=body.line_text,
        qualification=body.qualification.value,
        shift_id=body.shift_id,
        vacation_days_norm=body.vacation_days_norm,
        vacation_days_used=body.vacation_days_used,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        data["password_hash"] = get_password_hash(data.pop("password"))
    if "role" in data and hasattr(data["role"], "value"):
        data["role"] = data["role"].value
    if "qualification" in data and hasattr(data["qualification"], "value"):
        data["qualification"] = data["qualification"].value
    for k, v in data.items():
        setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    await db.delete(user)
    await db.commit()
