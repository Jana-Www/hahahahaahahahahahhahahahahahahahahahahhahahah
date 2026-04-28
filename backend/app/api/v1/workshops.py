import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user, require_manager
from app.models.models import Shift, Workshop
from app.schemas.schemas import (
    ShiftCreate, ShiftResponse,
    WorkshopCreate, WorkshopResponse, WorkshopUpdate, WorkshopWithShifts,
)

router = APIRouter(prefix="/workshops", tags=["workshops"])


@router.get("", response_model=list[WorkshopWithShifts])
async def list_workshops(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Workshop).order_by(Workshop.name))
    workshops = result.scalars().all()
    out = []
    for ws in workshops:
        shifts_res = await db.execute(select(Shift).where(Shift.workshop_id == ws.id))
        shifts = shifts_res.scalars().all()
        out.append(WorkshopWithShifts(
            id=ws.id, name=ws.name,
            shifts=[ShiftResponse.model_validate(s) for s in shifts]
        ))
    return out


@router.post("", response_model=WorkshopResponse, status_code=201)
async def create_workshop(
    body: WorkshopCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    ws = Workshop(name=body.name)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws


@router.put("/{workshop_id}", response_model=WorkshopResponse)
async def update_workshop(
    workshop_id: uuid.UUID,
    body: WorkshopUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    ws = await db.get(Workshop, workshop_id)
    if not ws:
        raise HTTPException(404, "Цех не найден")
    if body.name is not None:
        ws.name = body.name
    await db.commit()
    await db.refresh(ws)
    return ws


@router.delete("/{workshop_id}", status_code=204)
async def delete_workshop(
    workshop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    ws = await db.get(Workshop, workshop_id)
    if not ws:
        raise HTTPException(404, "Цех не найден")
    await db.delete(ws)
    await db.commit()


@router.get("/{workshop_id}/shifts", response_model=list[ShiftResponse])
async def list_shifts(
    workshop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(Shift).where(Shift.workshop_id == workshop_id).order_by(Shift.name)
    )
    return result.scalars().all()


@router.post("/{workshop_id}/shifts", response_model=ShiftResponse, status_code=201)
async def create_shift(
    workshop_id: uuid.UUID,
    body: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    ws = await db.get(Workshop, workshop_id)
    if not ws:
        raise HTTPException(404, "Цех не найден")
    shift = Shift(name=body.name, workshop_id=workshop_id)
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return shift


@router.delete("/{workshop_id}/shifts/{shift_id}", status_code=204)
async def delete_shift(
    workshop_id: uuid.UUID,
    shift_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    shift = await db.get(Shift, shift_id)
    if not shift or shift.workshop_id != workshop_id:
        raise HTTPException(404, "Смена не найдена")
    await db.delete(shift)
    await db.commit()
