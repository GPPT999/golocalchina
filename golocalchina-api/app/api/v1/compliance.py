"""Compliance MVP endpoints: consent ledger and DSR requests."""
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.compliance import ConsentEvent, DsrRequest
from app.models.user import User

router = APIRouter(prefix="/compliance", tags=["compliance"])


class CreateConsent(BaseModel):
    purpose_code: str = Field(min_length=2, max_length=64)
    policy_version: str = Field(min_length=2, max_length=64)
    granted: bool = True
    evidence_hash: str = Field(min_length=64, max_length=64)
    locale: str = Field(default="en-US", min_length=2, max_length=10)


class CreateDsrRequest(BaseModel):
    kind: Literal["ACCESS", "EXPORT", "CORRECT", "DELETE", "OBJECT_ADM", "RESTRICT"]
    regime: Literal["PIPL", "GDPR", "BOTH"] = "BOTH"
    notes: str | None = Field(default=None, max_length=2000)


def _consent_to_dict(consent: ConsentEvent) -> dict:
    return {
        "id": consent.id,
        "user_id": consent.user_id,
        "purpose_code": consent.purpose_code,
        "policy_version": consent.policy_version,
        "granted": consent.granted,
        "evidence_hash": consent.evidence_hash,
        "locale": consent.locale,
        "ip_addr": consent.ip_addr,
        "user_agent": consent.user_agent,
        "created_at": consent.created_at,
    }


def _dsr_to_dict(dsr: DsrRequest) -> dict:
    return {
        "id": dsr.id,
        "user_id": dsr.user_id,
        "kind": dsr.kind,
        "regime": dsr.regime,
        "status": dsr.status,
        "due_by": dsr.due_by,
        "notes": dsr.notes,
        "created_at": dsr.created_at,
        "updated_at": dsr.updated_at,
    }


@router.post("/consents", status_code=status.HTTP_201_CREATED)
async def create_consent(
    req: CreateConsent,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a per-purpose consent event for the authenticated user."""
    consent = ConsentEvent(
        user_id=current_user.id,
        purpose_code=req.purpose_code,
        policy_version=req.policy_version,
        granted=req.granted,
        evidence_hash=req.evidence_hash,
        locale=req.locale,
        ip_addr=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(consent)
    await db.flush()
    return _consent_to_dict(consent)


@router.get("/consents")
async def list_consents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List consent events for the authenticated user."""
    result = await db.execute(
        select(ConsentEvent)
        .where(ConsentEvent.user_id == current_user.id)
        .order_by(ConsentEvent.created_at.desc())
    )
    return [_consent_to_dict(consent) for consent in result.scalars().all()]


@router.post("/dsr-requests", status_code=status.HTTP_201_CREATED)
async def create_dsr_request(
    req: CreateDsrRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a data-subject-rights request with a 15-day response target."""
    due_by = (datetime.now(timezone.utc) + timedelta(days=15)).isoformat()
    dsr = DsrRequest(
        user_id=current_user.id,
        kind=req.kind,
        regime=req.regime,
        status="OPEN",
        due_by=due_by,
        notes=req.notes,
    )
    db.add(dsr)
    await db.flush()
    return _dsr_to_dict(dsr)


@router.get("/dsr-requests")
async def list_dsr_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List DSR requests for the authenticated user."""
    result = await db.execute(
        select(DsrRequest)
        .where(DsrRequest.user_id == current_user.id)
        .order_by(DsrRequest.created_at.desc())
    )
    return [_dsr_to_dict(dsr) for dsr in result.scalars().all()]
