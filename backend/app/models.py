"""
SQLAlchemy ORM models.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Admin(Base):
    """Singleton admin account."""

    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    """HiVoid client user (UUID-based)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=generate_uuid, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    max_connections = Column(Integer, default=0)  # 0 = unlimited
    data_limit_gb = Column(Integer, default=0)    # 0 = unlimited
    bandwidth_limit = Column(Integer, default=0)  # 0 = unlimited (KB/s)
    expire_at = Column(String, nullable=True)     # ISO 8601 String
    bytes_in = Column(Integer, default=0)
    bytes_out = Column(Integer, default=0)
    mode = Column(String, default="performance")
    obfs = Column(String, default="none")
    enabled = Column(Boolean, default=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PanelSettings(Base):
    """Panel configuration singleton row."""

    __tablename__ = "panel_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_address = Column(String(255), nullable=False)
    panel_port = Column(Integer, default=8443)
    theme = Column(String(10), default="dark")  # dark | light
    hivoid_config = Column(Text, nullable=True)  # JSON blob
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
