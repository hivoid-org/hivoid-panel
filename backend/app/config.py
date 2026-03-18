"""
Application configuration loaded from environment variables.
"""
import os
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Central configuration — loaded from .env or environment."""

    # Security
    SECRET_KEY: str = "changeme-generate-a-real-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./data/hivoid_panel.db"

    # Server info
    SERVER_ADDRESS: str = "0.0.0.0"
    PANEL_PORT: int = 8443

    # TLS
    CERT_FILE: str = "certs/cert.pem"
    KEY_FILE: str = "certs/key.pem"

    # HiVoid protocol binary paths
    HIVOID_BINARY_PATH: str = "/usr/local/bin/hivoid-server"
    HIVOID_CONFIG_PATH: str = "/opt/hivoid-panel/data/server.json"
    HIVOID_PID_PATH: str = "/tmp/hivoid-server.pid"

    # Default admin
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    # Rate limiting
    LOGIN_RATE_LIMIT: str = "5/minute"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
