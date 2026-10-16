from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Workforce Vision Platform Core API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://wfv_user:wfv_secret_2026@localhost:5432/wfv_db"
    
    # Security
    JWT_SECRET: str = "super_secret_jwt_key_wfv_2026_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # AES-GCM Key (32 bytes hex)
    AES_ENCRYPTION_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    
    # External Services
    GO2RTC_API_URL: str = "http://localhost:1984"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
