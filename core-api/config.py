import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRETS = {
    "super_secret_jwt_key_wfv_2026_production",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "wfv_internal_service_secret_key_2026",
    "CHANGE_ME",
    "CHANGE_ME_JWT_SECRET",
    "admin123",
    "secret"
}

class Settings(BaseSettings):
    ENV: str = "development" # development | production | test
    PROJECT_NAME: str = "Workforce Vision Platform Core API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEFAULT_TIMEZONE: str = "Asia/Tashkent"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://wfv_user:wfv_secret_2026@localhost:5432/wfv_db"
    
    # Security & Tokens
    JWT_SECRET: str = "super_secret_jwt_key_wfv_2026_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # Contract requirement: 15 minutes
    CHALLENGE_TOKEN_EXPIRE_MINUTES: int = 5 # Contract requirement: 5 minutes for 2FA challenge
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    LIVE_TICKET_EXPIRE_SECONDS: int = 30 # Single-use live stream ticket: 30 seconds
    
    # AES-256-GCM Key (32 bytes = 64 hex chars)
    AES_ENCRYPTION_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    
    # HMAC secret for internal service communications (vision-worker -> core-api)
    INTERNAL_SERVICE_SECRET: str = "wfv_internal_service_secret_key_2026"
    
    # External Services
    GO2RTC_API_URL: str = "http://localhost:1984"
    
    # Snapshot storage path
    SNAPSHOT_STORAGE_PATH: str = "./data/snapshots"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("JWT_SECRET", "AES_ENCRYPTION_KEY", "INTERNAL_SERVICE_SECRET")
    @classmethod
    def validate_production_secrets(cls, v: str, info) -> str:
        # If in production mode, disallow default/dummy secrets
        env = os.getenv("ENV", "development").lower()
        if env == "production":
            if not v or v in INSECURE_SECRETS or len(v) < 32:
                raise ValueError(
                    f"CRITICAL SECURITY: {info.field_name} must be set to a secure, non-default value in production!"
                )
        return v

    @field_validator("AES_ENCRYPTION_KEY")
    @classmethod
    def validate_aes_key_length(cls, v: str) -> str:
        try:
            raw = bytes.fromhex(v)
            if len(raw) != 32:
                raise ValueError("AES_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)")
        except ValueError:
            raise ValueError("AES_ENCRYPTION_KEY must be a valid 64-character hexadecimal string")
        return v

settings = Settings()
