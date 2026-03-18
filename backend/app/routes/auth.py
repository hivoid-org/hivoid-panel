"""
Authentication routes: login, change-password, token validation.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import Admin
from app.schemas import (
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
)
from app.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_admin,
)
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate admin and return JWT token."""
    admin = db.query(Admin).filter(Admin.username == body.username).first()
    if not admin or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(data={"sub": admin.username})
    return TokenResponse(access_token=token)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    body: ChangePasswordRequest,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Change the current admin's password (requires old password)."""
    if not verify_password(body.current_password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    admin.hashed_password = hash_password(body.new_password)
    db.commit()
    return MessageResponse(message="Password changed successfully")


@router.post("/profile", response_model=MessageResponse)
def update_profile(
    new_username: str,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Change the admin's username."""
    # Check if username is taken
    existing = db.query(Admin).filter(Admin.username == new_username).first()
    if existing and existing.id != admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )
    
    admin.username = new_username
    db.commit()
    return MessageResponse(message="Username updated successfully")



@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    body: ResetPasswordRequest,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Force-reset the admin password (already authenticated)."""
    admin.hashed_password = hash_password(body.new_password)
    db.commit()
    return MessageResponse(message="Password reset successfully")


@router.get("/me")
def me(admin: Admin = Depends(get_current_admin)):
    """Return current admin info (validates the token)."""
    return {"username": admin.username}
