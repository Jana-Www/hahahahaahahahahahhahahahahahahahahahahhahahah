from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1 import (
    auth, conflicts, coverage_rules, dashboard,
    schedule, season_periods, users, vacation_blocks, wishes, workshops,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Vacation Planner API",
    version="1.0.0",
    description="AI-планировщик отпусков производственного подразделения",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(workshops.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(season_periods.router, prefix=PREFIX)
app.include_router(coverage_rules.router, prefix=PREFIX)
app.include_router(wishes.router, prefix=PREFIX)
app.include_router(schedule.router, prefix=PREFIX)
app.include_router(vacation_blocks.router, prefix=PREFIX)
app.include_router(conflicts.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "vacation-planner", "version": "1.0.0"}
