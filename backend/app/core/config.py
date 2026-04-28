from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/vacation_planner"
    SECRET_KEY: str = "dev-secret-key-change-in-production-32chars!!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    ENVIRONMENT: str = "development"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
