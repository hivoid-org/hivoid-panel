"""
SQLAlchemy database engine, session factory, and base model.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Support both sqlite:/// and sqlite+aiosqlite:/// for sync usage
_db_url = settings.DATABASE_URL
if _db_url.startswith("sqlite"):
    _db_url = _db_url.replace("sqlite+aiosqlite", "sqlite")
    import os, urllib.parse
    parsed = urllib.parse.urlparse(_db_url)
    db_path = os.path.abspath(parsed.path[1:] if parsed.path.startswith('/') and os.name == 'nt' else parsed.path.lstrip('/'))
    if not db_path:
        db_path = parsed.netloc
    
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    _db_url,
    connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
