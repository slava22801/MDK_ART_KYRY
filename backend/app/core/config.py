from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL", default="redis://redis:6379/0")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = Field(alias="JWT_ALGORITHM", default="HS256")
    jwt_access_ttl_min: int = Field(alias="JWT_ACCESS_TTL_MIN", default=60)

    s3_endpoint: str = Field(alias="S3_ENDPOINT")
    s3_access_key: str = Field(alias="S3_ACCESS_KEY")
    s3_secret_key: str = Field(alias="S3_SECRET_KEY")
    s3_bucket: str = Field(alias="S3_BUCKET")
    s3_region: str = Field(alias="S3_REGION", default="us-east-1")

    payment_provider: str = Field(alias="PAYMENT_PROVIDER", default="stub")
    payment_webhook_secret: str = Field(alias="PAYMENT_WEBHOOK_SECRET")

    reservation_hold_min: int = Field(alias="RESERVATION_HOLD_MIN", default=15)
    reservation_default_duration_min: int = Field(
        alias="RESERVATION_DEFAULT_DURATION_MIN", default=120
    )
    deposit_amount: int = Field(alias="DEPOSIT_AMOUNT", default=500)

    seed_admin_email: str = Field(alias="SEED_ADMIN_EMAIL", default="admin@art-kyry.local")
    seed_admin_password: str = Field(alias="SEED_ADMIN_PASSWORD", default="admin12345")
    seed_admin_name: str = Field(alias="SEED_ADMIN_NAME", default="Администратор")
    seed_test_client_email: str = Field(
        alias="SEED_TEST_CLIENT_EMAIL", default="client@art-kyry.local"
    )
    seed_test_client_password: str = Field(
        alias="SEED_TEST_CLIENT_PASSWORD", default="client12345"
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost", "http://localhost:80"]
    )
    frontend_base_url: str = Field(alias="FRONTEND_BASE_URL", default="http://localhost")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()