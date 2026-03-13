from functools import lru_cache
from typing import List

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    app_name: str = 'IOTX Coinbase Bot'
    app_env: str = 'development'
    app_debug: bool = True
    api_prefix: str = '/api/v1'
    app_origins: str = 'http://localhost:3000'
    trusted_hosts: str = 'localhost,127.0.0.1'

    jwt_secret_key: str
    jwt_algorithm: str = 'HS256'
    jwt_access_token_expire_minutes: int = 720

    admin_username: str = 'admin'
    admin_password: str = 'change-me-now'

    database_url: str = 'sqlite:///./bot.db'

    coinbase_api_key: str | None = None
    coinbase_api_secret: str | None = None
    coinbase_sandbox: bool = False
    coinbase_timeout_seconds: int = 10

    default_asset: str = 'ETH-USD'
    allowed_assets: str = 'ETH-USD,IOTX-USD,BTC-USD'
    heartbeat_stale_seconds: int = 15
    max_reconnect_attempts: int = 10
    rate_limit: str = '120/minute'

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.app_origins.split(',') if o.strip()]

    @computed_field  # type: ignore[misc]
    @property
    def host_allowlist(self) -> List[str]:
        return [h.strip() for h in self.trusted_hosts.split(',') if h.strip()]

    @computed_field  # type: ignore[misc]
    @property
    def allowed_assets_list(self) -> List[str]:
        return [a.strip() for a in self.allowed_assets.split(',') if a.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
