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
    TOTPSetupResponse,
    TOTPVerifyRequest,
)
from app.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_admin,
)
from app.config import settings
import pyotp
import qrcode
import io
import base64

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
    
    if admin.totp_enabled:
        if not body.totp_code:
            return TokenResponse(totp_required=True)
        
        totp = pyotp.TOTP(admin.totp_secret)
        if not totp.verify(body.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code",
            )

    token = create_access_token(data={"sub": admin.username})
    return TokenResponse(access_token=token)


@router.get("/totp/setup", response_model=TOTPSetupResponse)
def totp_setup(admin: Admin = Depends(get_current_admin)):
    """Generate TOTP secret and QR code for setup."""
    secret = pyotp.random_base32()
    uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=admin.username, 
        issuer_name="HiVoid Panel"
    )
    
    img = qrcode.make(uri)
    buffered = io.BytesIO()
    img.save(buffered) # type: ignore
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return TOTPSetupResponse(
        secret=secret,
        qr_code=f"data:image/png;base64,{img_str}"
    )


@router.post("/totp/verify", response_model=MessageResponse)
def totp_verify(
    body: TOTPVerifyRequest,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Verify and enable TOTP for the account."""
    totp = pyotp.TOTP(body.secret)
    if not totp.verify(body.token):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    admin.totp_secret = body.secret
    admin.totp_enabled = True
    db.commit()
    return MessageResponse(message="Two-factor authentication enabled successfully")


@router.post("/totp/disable", response_model=MessageResponse)
def totp_disable(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Disable TOTP for the account."""
    admin.totp_enabled = False
    admin.totp_secret = None
    db.commit()
    return MessageResponse(message="Two-factor authentication disabled")


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
    return {
        "username": admin.username,
        "totp_enabled": admin.totp_enabled
    }
