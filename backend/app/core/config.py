from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FashionCart API"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api"
    database_url: str = "mysql+pymysql://fashioncart:fashioncart@db:3306/fashioncart"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    log_level: str = "INFO"
    rate_limit_enabled: bool = True
    allow_registration: bool = True
    # Conservative defaults for autoscaling/serverless deployments.
    # Override upward only when the managed database connection limit permits it.
    db_pool_size: int = 2
    db_max_overflow: int = 3
    db_pool_recycle: int = 300
    db_pool_timeout: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.app_env.lower() == "production":
            weak = (
                len(self.jwt_secret) < 32
                or self.jwt_secret in {"change-me-in-production", "replace-with-a-long-random-secret"}
                or self.jwt_secret.startswith("replace-")
            )
            if weak:
                raise ValueError("JWT_SECRET must be replaced with a random secret of at least 32 characters in production")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
