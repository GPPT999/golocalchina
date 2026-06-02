"""Async SQLAlchemy engine + session factory.

Merged from golocalchina-backend:
- Supports both SQLite and PostgreSQL
- Connection pooling for PostgreSQL
- Proper error handling and rollback
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Ensure SQLite directory exists
db_url = settings.database_url
if "sqlite" in db_url:
    db_path = db_url.split("///")[-1]
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

# Configure engine based on database type
connect_args = {}
pool_kwargs = {}

if "sqlite" in db_url:
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL: enable connection pooling
    pool_kwargs = {
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    }

engine = create_async_engine(
    db_url,
    echo=settings.debug,
    connect_args=connect_args,
    **pool_kwargs,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields one transaction per request."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create all tables — used on startup."""
    from app.models.base import Base
    from app.models import user, listing, booking, compliance  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f"[DB] Tables created. URL: {db_url}")
