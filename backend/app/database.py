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
