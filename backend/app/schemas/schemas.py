from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.models import JobStatus, Qualification, SeasonStatus, UserRole, VacationStatus


# ── Workshop ──────────────────────────────────────────────────────────────────

class WorkshopCreate(BaseModel):
    name: str


class WorkshopUpdate(BaseModel):
    name: str | None = None


class WorkshopResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str


# ── Shift ─────────────────────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    name: str


class ShiftUpdate(BaseModel):
    name: str | None = None


class ShiftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    workshop_id: UUID


class WorkshopWithShifts(WorkshopResponse):
    shifts: list[ShiftResponse] = []


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    full_name: str
    login: str
    password: str
    role: UserRole = UserRole.EMPLOYEE
    position: str | None = None
    line_text: str | None = None
    qualification: Qualification = Qualification.STD
    shift_id: UUID | None = None
    vacation_days_norm: int = 28
    vacation_days_used: int = 0


class UserUpdate(BaseModel):
    full_name: str | None = None
    login: str | None = None
    password: str | None = None
    role: UserRole | None = None
    position: str | None = None
    line_text: str | None = None
    qualification: Qualification | None = None
    shift_id: UUID | None = None
    vacation_days_norm: int | None = None
    vacation_days_used: int | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str
    login: str
    role: UserRole
    position: str | None = None
    line_text: str | None = None
    qualification: Qualification
    shift_id: UUID | None = None
    vacation_days_norm: int
    vacation_days_used: int


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── SeasonPeriod ──────────────────────────────────────────────────────────────

class SeasonPeriodCreate(BaseModel):
    year: int
    date_start: date
    date_end: date
    status: SeasonStatus


class SeasonPeriodUpdate(BaseModel):
    year: int | None = None
    date_start: date | None = None
    date_end: date | None = None
    status: SeasonStatus | None = None


class SeasonPeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    year: int
    date_start: date
    date_end: date
    status: SeasonStatus


# ── CoverageRule ──────────────────────────────────────────────────────────────

class CoverageRuleCreate(BaseModel):
    workshop_id: UUID
    period_status: SeasonStatus
    min_total: int
    min_key: int
    max_on_vacation: int | None = None


class CoverageRuleUpdate(BaseModel):
    min_total: int | None = None
    min_key: int | None = None
    max_on_vacation: int | None = None


class CoverageRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    workshop_id: UUID
    period_status: SeasonStatus
    min_total: int
    min_key: int
    max_on_vacation: int | None = None


# ── WishRequest ───────────────────────────────────────────────────────────────

class WishRequestUpdate(BaseModel):
    v1_start: date | None = None
    v1_end: date | None = None
    v1_comment: str | None = None
    v2_start: date | None = None
    v2_end: date | None = None
    v2_comment: str | None = None
    v3_start: date | None = None
    v3_end: date | None = None
    v3_comment: str | None = None


class WishRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    year: int
    is_locked: bool
    v1_start: date | None = None
    v1_end: date | None = None
    v1_comment: str | None = None
    v2_start: date | None = None
    v2_end: date | None = None
    v2_comment: str | None = None
    v3_start: date | None = None
    v3_end: date | None = None
    v3_comment: str | None = None


class WishRequestWithUser(WishRequestResponse):
    user: UserResponse


# ── VacationBlock ─────────────────────────────────────────────────────────────

class VacationBlockUpdate(BaseModel):
    status: VacationStatus | None = None
    date_start: date | None = None
    date_end: date | None = None
    manager_comment: str | None = None


class VacationBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    year: int
    date_start: date
    date_end: date
    status: VacationStatus
    wish_variant_used: int | None = None
    ai_explanation: str | None = None
    manager_comment: str | None = None
    updated_at: datetime


class VacationBlockWithUser(VacationBlockResponse):
    user: UserResponse


# ── GenerationJob ─────────────────────────────────────────────────────────────

class GenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    year: int
    status: JobStatus
    error_message: str | None = None
    started_at: datetime
    finished_at: datetime | None = None


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_employees: int
    approved: int
    pending: int
    draft: int
    conflict: int
    modified: int
    without_wishes: int


# ── Conflict ──────────────────────────────────────────────────────────────────

class ConflictItem(BaseModel):
    code: str
    severity: str
    description: str
    employee_name: str | None = None
    workshop_name: str | None = None
    date_start: date | None = None
    date_end: date | None = None
    ai_recommendation: str | None = None
