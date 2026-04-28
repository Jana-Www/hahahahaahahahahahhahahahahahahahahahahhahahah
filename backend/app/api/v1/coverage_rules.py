import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db, require_manager
from app.models.models import CoverageRule
from app.schemas.schemas import CoverageRuleCreate, CoverageRuleResponse, CoverageRuleUpdate

router = APIRouter(prefix="/coverage-rules", tags=["coverage-rules"])


@router.get("", response_model=list[CoverageRuleResponse])
async def list_coverage_rules(
    workshop_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(CoverageRule)
    if workshop_id:
        q = q.where(CoverageRule.workshop_id == workshop_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=CoverageRuleResponse, status_code=201)
async def create_coverage_rule(
    body: CoverageRuleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    rule = CoverageRule(
        workshop_id=body.workshop_id,
        period_status=body.period_status.value,
        min_total=body.min_total,
        min_key=body.min_key,
        max_on_vacation=body.max_on_vacation,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/{rule_id}", response_model=CoverageRuleResponse)
async def update_coverage_rule(
    rule_id: uuid.UUID,
    body: CoverageRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    rule = await db.get(CoverageRule, rule_id)
    if not rule:
        raise HTTPException(404, "Норма покрытия не найдена")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
async def delete_coverage_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    rule = await db.get(CoverageRule, rule_id)
    if not rule:
        raise HTTPException(404, "Норма покрытия не найдена")
    await db.delete(rule)
    await db.commit()
