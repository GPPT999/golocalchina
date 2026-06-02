"""Authentication dependencies for private API endpoints."""
from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _auth_error(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Return the active user identified by a bearer access token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _auth_error()

    try:
        payload = decode_token(credentials.credentials)
    except Exception:
        raise _auth_error("Invalid token")

    if payload.get("type") != "access":
        raise _auth_error("Invalid token type")

    subject = payload.get("sub")
    if not subject:
        raise _auth_error("Invalid token subject")

    result = await db.execute(
        select(User).where(User.id == str(subject), User.status == "active")
    )
    user = result.scalar_one_or_none()
    if not user:
        raise _auth_error("User not found")
    return user


def ensure_role(user: User, allowed_roles: Iterable[str]) -> None:
    """Raise 403 when the authenticated user does not have an allowed role."""
    if user.role not in set(allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role",
        )
