import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"


class Qualification(str, enum.Enum):
    KEY = "KEY"
    STD = "STD"


class SeasonStatus(str, enum.Enum):
    HIGH = "HIGH"
    LOW = "LOW"
    NEUTRAL = "NEUTRAL"


class VacationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    MODIFIED = "MODIFIED"
    CONFLICT = "CONFLICT"


class JobStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# ── Models ───────────────────────────────────────────────────────────────────

class Workshop(Base):
    __tablename__ = "workshops"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    shifts: Mapped[list["Shift"]] = relationship(
        "Shift", back_populates="workshop", cascade="all, delete-orphan"
    )
    coverage_rules: Mapped[list["CoverageRule"]] = relationship(
        "CoverageRule", back_populates="workshop", cascade="all, delete-orphan"
    )


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    workshop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workshops.id", ondelete="CASCADE"), nullable=False
    )

    workshop: Mapped["Workshop"] = relationship("Workshop", back_populates="shifts")
    users: Mapped[list["User"]] = relationship("User", back_populates="shift")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    login: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=UserRole.EMPLOYEE)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    line_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qualification: Mapped[str] = mapped_column(String(10), nullable=False, default=Qualification.STD)
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True
    )
    vacation_days_norm: Mapped[int] = mapped_column(Integer, default=28)
    vacation_days_used: Mapped[int] = mapped_column(Integer, default=0)

    shift: Mapped["Shift | None"] = relationship("Shift", back_populates="users")
    wish_requests: Mapped[list["WishRequest"]] = relationship(
        "WishRequest", back_populates="user", cascade="all, delete-orphan"
    )
    vacation_blocks: Mapped[list["VacationBlock"]] = relationship(
        "VacationBlock", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def role_enum(self) -> UserRole:
        return UserRole(self.role)

    @property
    def qualification_enum(self) -> Qualification:
        return Qualification(self.qualification)


class SeasonPeriod(Base):
    __tablename__ = "season_periods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)


class CoverageRule(Base):
    __tablename__ = "coverage_rules"
    __table_args__ = (UniqueConstraint("workshop_id", "period_status", name="uq_coverage_workshop_status"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workshop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workshops.id", ondelete="CASCADE"), nullable=False
    )
    period_status: Mapped[str] = mapped_column(String(10), nullable=False)
    min_total: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    min_key: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_on_vacation: Mapped[int | None] = mapped_column(Integer, nullable=True)

    workshop: Mapped["Workshop"] = relationship("Workshop", back_populates="coverage_rules")


class WishRequest(Base):
    __tablename__ = "wish_requests"
    __table_args__ = (UniqueConstraint("user_id", "year", name="uq_wish_user_year"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    v1_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    v1_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    v1_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    v2_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    v2_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    v2_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    v3_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    v3_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    v3_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="wish_requests")


class VacationBlock(Base):
    __tablename__ = "vacation_blocks"
    __table_args__ = (UniqueConstraint("user_id", "year", name="uq_block_user_year"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=VacationStatus.DRAFT)
    wish_variant_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    manager_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", back_populates="vacation_blocks")


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=JobStatus.RUNNING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
