"""
Panel settings routes: get/update server address, port, theme.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin, PanelSettings
from app.schemas import PanelSettingsUpdate, PanelSettingsResponse, MessageResponse
from app.auth import get_current_admin
from app.config import settings as app_settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _get_or_create_settings(db: Session) -> PanelSettings:
    """Get the singleton settings row or create it."""
    s = db.query(PanelSettings).first()
    if not s:
        s = PanelSettings(
            server_address=app_settings.SERVER_ADDRESS,
            panel_port=app_settings.PANEL_PORT,
            theme="dark",
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("", response_model=PanelSettingsResponse)
def get_settings(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get current panel settings."""
    return _get_or_create_settings(db)


@router.put("", response_model=PanelSettingsResponse)
def update_settings(
    body: PanelSettingsUpdate,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update panel settings."""
    s = _get_or_create_settings(db)

    update_data = body.model_dump(exclude_unset=True)

    if "theme" in update_data and update_data["theme"] not in ("dark", "light"):
        raise HTTPException(status_code=400, detail="Theme must be 'dark' or 'light'")

    for key, value in update_data.items():
        setattr(s, key, value)

    db.commit()
    db.refresh(s)
    return s
