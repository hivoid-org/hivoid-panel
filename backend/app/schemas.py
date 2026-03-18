"""
Pydantic schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ───────── Auth ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=255)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=255)


# ───────── Users ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    uuid: Optional[str] = None
    max_connections: int = Field(default=0, ge=0)
    data_limit_gb: int = Field(default=0, ge=0)
    bandwidth_limit: int = Field(default=0, ge=0)  # KB/s
    expire_at: Optional[str] = None
    mode: str = "performance"  # performance | high_performance | stealth | balanced | adaptive
    obfs: str = "none"         # none | random | http | tls
    enabled: bool = True
    note: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = None
    max_connections: Optional[int] = Field(default=None, ge=0)
    data_limit_gb: Optional[int] = Field(default=None, ge=0)
    bandwidth_limit: Optional[int] = Field(default=None, ge=0)
    expire_at: Optional[str] = None
    mode: Optional[str] = None
    obfs: Optional[str] = None
    enabled: Optional[bool] = None
    note: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    uuid: str
    name: str
    email: Optional[str] = None
    max_connections: int
    data_limit_gb: int
    bandwidth_limit: int
    expire_at: Optional[str] = None
    bytes_in: int
    bytes_out: int
    mode: str
    obfs: str
    enabled: bool
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ───────── Settings ──────────────────────────────────────────────────────────

class PanelSettingsUpdate(BaseModel):
    server_address: Optional[str] = None
    panel_port: Optional[int] = Field(default=None, ge=1, le=65535)
    theme: Optional[str] = None  # dark | light


class PanelSettingsResponse(BaseModel):
    server_address: str
    panel_port: int
    theme: str

    class Config:
        from_attributes = True


# ───────── System ────────────────────────────────────────────────────────────

class SystemStatsResponse(BaseModel):
    cpu_percent: float
    cpu_count: int
    ram_total_gb: float
    ram_used_gb: float
    ram_percent: float
    uptime_seconds: float
    uptime_human: str


class ProtocolStatusResponse(BaseModel):
    running: bool
    pid: Optional[int] = None
    uptime: Optional[str] = None


class MessageResponse(BaseModel):
    message: str
    success: bool = True
