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
    totp_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    totp_required: bool = False
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=255)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=255)


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_code: str  # Base64 data URI


class TOTPVerifyRequest(BaseModel):
    token: str
    secret: str  # Secret is passed back to verify before enabling if not saved yet


# ───────── Users ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    uuid: Optional[str] = None
    max_connections: int = Field(default=0, ge=0)
    max_ips: int = Field(default=0, ge=0)
    bind_ip: Optional[str] = None
    data_limit_gb: int = Field(default=0, ge=0)
    bandwidth_limit: int = Field(default=0, ge=0)  # KB/s
    expire_at: Optional[str] = None
    mode: str = "performance"  # performance | high_performance | stealth | balanced | adaptive
    obfs: str = "none"         # none | random | http | tls | masque | webtransport | ghost
    enabled: bool = True
    note: Optional[str] = None
    pool_size: int = Field(default=4, ge=1, le=16)
    bypass_domains: Optional[str] = ""
    bypass_ips: Optional[str] = ""
    geoip_path: Optional[str] = ""
    geosite_path: Optional[str] = ""
    direct_route: Optional[str] = ""
    cert_pin: Optional[str] = ""
    blocked_hosts: Optional[str] = ""
    blocked_tags: Optional[str] = ""


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = None
    max_connections: Optional[int] = Field(default=None, ge=0)
    max_ips: Optional[int] = Field(default=None, ge=0)
    bind_ip: Optional[str] = None
    data_limit_gb: Optional[int] = Field(default=None, ge=0)
    bandwidth_limit: Optional[int] = Field(default=None, ge=0)
    expire_at: Optional[str] = None
    mode: Optional[str] = None
    obfs: Optional[str] = None  # none | random | http | tls | masque | webtransport | ghost
    enabled: Optional[bool] = None
    note: Optional[str] = None
    pool_size: Optional[int] = Field(default=None, ge=1, le=16)
    bypass_domains: Optional[str] = None
    bypass_ips: Optional[str] = None
    geoip_path: Optional[str] = None
    geosite_path: Optional[str] = None
    direct_route: Optional[str] = None
    cert_pin: Optional[str] = None
    blocked_hosts: Optional[str] = None
    blocked_tags: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    uuid: str
    name: str
    email: Optional[str] = None
    max_connections: int
    max_ips: int
    bind_ip: Optional[str] = None
    data_limit_gb: int
    bandwidth_limit: int
    expire_at: Optional[str] = None
    bytes_in: int
    bytes_out: int
    mode: str
    obfs: str  # none | random | http | tls | masque | webtransport | ghost
    enabled: bool
    note: Optional[str] = None
    pool_size: int
    bypass_domains: str
    bypass_ips: str
    geoip_path: str
    geosite_path: str
    direct_route: str
    cert_pin: str
    blocked_hosts: str
    blocked_tags: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ───────── Settings ──────────────────────────────────────────────────────────

class PanelSettingsUpdate(BaseModel):
    server_address: Optional[str] = None
    panel_port: Optional[int] = Field(default=None, ge=1, le=65535)
    theme: Optional[str] = None  # dark | light
    hivoid_config: Optional[str] = None


class PanelSettingsResponse(BaseModel):
    server_address: str
    panel_port: int
    theme: str
    hivoid_config: Optional[str] = None

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
    os_name: Optional[str] = None


class ProtocolStatusResponse(BaseModel):
    running: bool
    pid: Optional[int] = None
    uptime: Optional[str] = None
    version: Optional[str] = None
    cert_pin: Optional[str] = None
    anti_probe: bool = False
    cert_pinning: bool = False
    geodata_installed: bool = False


class MessageResponse(BaseModel):
    message: str
    success: bool = True
