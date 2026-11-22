from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.engine import Connection


_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    database_url: str
    app_env: Literal["development", "test", "staging", "production"] = "production"
    staging_neon_branch_id: str | None = None
    production_neon_branch_id: str | None = None
    jwt_secret: str = "development-only-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    @model_validator(mode="after")
    def validate_database_target(self):
        scheme = urlsplit(self.database_url).scheme.lower()
        postgres_schemes = {"postgres", "postgresql", "postgresql+psycopg"}
        if self.app_env in {"production", "staging"} and scheme not in postgres_schemes:
            raise ValueError(f"{self.app_env} requires a PostgreSQL DATABASE_URL")
        if self.app_env == "test" and scheme != "sqlite":
            raise ValueError("test requires an explicit SQLite DATABASE_URL")
        if self.app_env == "development" and scheme not in postgres_schemes | {"sqlite"}:
            raise ValueError("development requires an explicit PostgreSQL or SQLite DATABASE_URL")
        if self.jwt_algorithm != "HS256":
            raise ValueError("Only HS256 JWT signing is supported")
        if self.app_env in {"staging", "production"}:
            if self.jwt_secret == "development-only-secret" or len(self.jwt_secret.encode("utf-8")) < 32:
                raise ValueError("staging and production require a JWT_SECRET of at least 32 bytes")
        if self.app_env == "staging":
            if not self.staging_neon_branch_id or not self.production_neon_branch_id:
                raise ValueError("staging requires explicit staging and production Neon branch IDs")
            if self.staging_neon_branch_id == self.production_neon_branch_id:
                raise ValueError("staging and production Neon branch IDs must differ")
        return self


settings = Settings()


def require_staging_database(connection: Connection) -> None:
    if settings.app_env != "staging":
        raise RuntimeError("Database writes require APP_ENV=staging")
    if not settings.staging_neon_branch_id or not settings.production_neon_branch_id:
        raise RuntimeError("Explicit staging and production Neon branch IDs are required")

    branch_id = connection.execute(
        text("SELECT current_setting('neon.branch_id', true)")
    ).scalar_one_or_none()
    if not branch_id or branch_id != settings.staging_neon_branch_id:
        raise RuntimeError("Connected Neon branch does not match STAGING_NEON_BRANCH_ID")
    if branch_id == settings.production_neon_branch_id:
        raise RuntimeError("Refusing writes to the configured production Neon branch")
