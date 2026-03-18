"""
User management routes: CRUD + search + enable/disable.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

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
