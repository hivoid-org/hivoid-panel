"""
HiVoid Panel — FastAPI Application Entry Point

Serves the REST API and the built React frontend as static files.
"""
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models import Admin, PanelSettings
from app.auth import hash_password

# Route imports
from app.routes import auth, users, system, protocol, settings as settings_routes


def _seed_admin():
    """Create the default admin if the table is empty."""
    db = SessionLocal()
    try:
        if db.query(Admin).count() == 0:
            admin = Admin(
                username=settings.ADMIN_USERNAME,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


def _seed_settings():
    """Create default panel settings if not present."""
    db = SessionLocal()
    try:
        if db.query(PanelSettings).count() == 0:
            ps = PanelSettings(
                server_address=settings.SERVER_ADDRESS,
                panel_port=settings.PANEL_PORT,
                theme="dark",
            )
            db.add(ps)
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    _seed_admin()
    _seed_settings()
    yield


# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HiVoid Panel",
    description="Management panel for HiVoid protocol server",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ─── Rate Limiter ────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routes ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(system.router)
app.include_router(protocol.router)
app.include_router(settings_routes.router)


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "hivoid-panel"}


# ─── Serve React SPA ────────────────────────────────────────────────────────
# The React build output is placed next to the backend
_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if _frontend_dist.is_dir():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Catch-all: serve index.html for client-side routing."""
        file_path = _frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_frontend_dist / "index.html"))
