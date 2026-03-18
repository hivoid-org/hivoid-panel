"""
User management routes: CRUD + search + enable/disable.
"""
import uuid
import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.config import settings

from app.database import get_db
from app.models import User, Admin
from app.schemas import UserCreate, UserUpdate, UserResponse, MessageResponse
from app.auth import get_current_admin
from app.routes.protocol import sync_server_config

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
def list_users(
    search: Optional[str] = Query(None, description="Search by name, uuid, or email"),
    enabled: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List all users with optional search and filter."""
    query = db.query(User)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.name.ilike(pattern),
                User.uuid.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    if enabled is not None:
        query = query.filter(User.enabled == enabled)

    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    # Merge live usage from .usage.json
    usage_map = {}
    config_path = Path(settings.HIVOID_CONFIG_PATH)
    usage_path = Path(str(config_path) + ".usage.json")
    if usage_path.exists():
        try:
            usage_data = json.loads(usage_path.read_text())
            for u_usage in usage_data.get("users", []):
                usage_map[u_usage["uuid"]] = u_usage
        except Exception:
            pass

    for u in users:
        live = usage_map.get(u.uuid)
        if live:
            u.bytes_in = live.get("bytes_in", u.bytes_in)
            u.bytes_out = live.get("bytes_out", u.bytes_out)

    return users


@router.get("/count")
def user_count(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Return total and active user counts."""
    total = db.query(User).count()
    active = db.query(User).filter(User.enabled == True).count()
    return {"total": total, "active": active}


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new HiVoid user."""
    user_uuid = body.uuid or str(uuid.uuid4())

    # Check uniqueness
    if db.query(User).filter(User.uuid == user_uuid).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"UUID {user_uuid} already exists",
        )

    user = User(
        uuid=user_uuid,
        name=body.name,
        email=body.email,
        max_connections=body.max_connections,
        data_limit_gb=body.data_limit_gb,
        bandwidth_limit=body.bandwidth_limit,
        expire_at=body.expire_at,
        mode=body.mode,
        obfs=body.obfs,
        enabled=body.enabled,
        note=body.note,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    sync_server_config(db)
    return user


@router.get("/generate-uuid")
def generate_user_uuid(admin: Admin = Depends(get_current_admin)):
    """Generate a new random UUID."""
    return {"uuid": str(uuid.uuid4())}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get a specific user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserUpdate,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update an existing user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    sync_server_config(db)
    return user


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    sync_server_config(db)
    return MessageResponse(message=f"User '{user.name}' deleted")


@router.post("/{user_id}/toggle", response_model=UserResponse)
def toggle_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Enable/disable a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.enabled = not user.enabled
    db.commit()
    db.refresh(user)
    sync_server_config(db)
    return user


@router.get("/{user_id}/config")
def get_user_config_data(
    user_id: int,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Generate raw JSON and subscription URL for a user."""
    from app.config import settings
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Construct client.json content
    client_json = {
        "uuid": user.uuid,
        "server": settings.SERVER_ADDRESS or request.base_url.hostname,
        "port": 4433, # Standard Core port
        "mode": user.mode or "performance",
        "obfs": user.obfs or "none",
        "socks_port": 1080,
        "dns_port": 5353,
        "dns_upstream": "1.1.1.1:53",
        "insecure": True,
        "name": user.name or user.email or "HiVoid Configuration"
    }

    # Construct subscription URL
    base_url = str(request.base_url).rstrip("/")
    sub_url = f"{base_url}/api/users/sub/{user.uuid}"

    # Construct hivoid:// Protocol Link
    import urllib.parse
    safe_name = urllib.parse.quote(user.name or user.email or "HiVoid")
    protocol_link = f"hivoid://{user.uuid}@{client_json['server']}:{client_json['port']}?mode={client_json['mode']}&obfs={client_json['obfs']}#{safe_name}"

    return {
        "json": client_json,
        "url": sub_url,
        "protocol": protocol_link
    }


@router.get("/sub/{user_uuid}", tags=["Public"])
def public_config_subscription(
    user_uuid: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Public endpoint for clients to fetch their JSON config via UUID."""
    from app.config import settings
    user = db.query(User).filter(User.uuid == user_uuid).first()
    if not user or not user.enabled:
        raise HTTPException(status_code=404, detail="Configuration not found or user disabled.")

    client_json = {
        "uuid": user.uuid,
        "server": settings.SERVER_ADDRESS or request.base_url.hostname,
        "port": 4433,
        "mode": user.mode or "performance",
        "obfs": user.obfs or "none",
        "socks_port": 1080,
        "dns_port": 5353,
        "dns_upstream": "1.1.1.1:53",
        "insecure": True,
        "name": user.name or user.email or "HiVoid Client"
    }
    return client_json
