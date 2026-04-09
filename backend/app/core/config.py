from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://bindervault:bindervault_secret@db:5432/bindervault"
    redis_url: str = "redis://redis:6379"
    secret_key: str = "change_me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    scryfall_api_base: str = "https://api.scryfall.com"
    environment: str = "development"
    cors_origins: str = "http://localhost,http://localhost:80,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
# Expose as list for middleware
settings.cors_origins = settings.cors_origins_list  # type: ignore
