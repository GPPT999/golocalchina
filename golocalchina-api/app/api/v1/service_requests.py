"""Service Request endpoints — connection requests."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import ensure_role, get_current_user
from app.core.database import get_db
from app.models.listing import GuideListing
from app.models.booking import Review, ServiceRequest
from app.models.user import User
from app.schemas.service_request import CreateServiceRequest, ServiceRequestResponse

router = APIRouter(prefix="/service-requests", tags=["service-requests"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service_request(
    req: CreateServiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tourist requests to connect with a guide. Listing is optional."""
    ensure_role(current_user, ["tourist"])
    quoted = req.quoted_amount or 0
    currency = req.quoted_currency or "CNY"

    guide_result = await db.execute(
        select(User).where(
            User.id == req.guide_user_id,
            User.role == "guide",
            User.status == "active",
        )
    )
    if not guide_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Selected guide is not available")

    # If listing provided, require it to be available for the selected guide.
    if req.listing_id:
        listing_result = await db.execute(
            select(GuideListing).where(GuideListing.id == req.listing_id)
        )
        listing = listing_result.scalar_one_or_none()
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        if listing.guide_user_id != req.guide_user_id:
            raise HTTPException(status_code=400, detail="Listing does not belong to the selected guide")
        if listing.status != "published":
            raise HTTPException(status_code=400, detail="Listing is not available")
        quoted = float(listing.price_amount)
        currency = listing.price_currency

    sr = ServiceRequest(
        tourist_user_id=current_user.id,
        guide_user_id=req.guide_user_id,
        listing_id=req.listing_id,
        service_date=str(req.service_date),
        service_time_hour=req.service_time_hour,
        party_size=req.party_size,
        language=req.language,
        tourist_notes=req.tourist_notes,
        quoted_amount=quoted,
        quoted_currency=currency,
        status="pending",
    )
    db.add(sr)
    await db.flush()
    return {
        "id": sr.id, "tourist_user_id": sr.tourist_user_id, "guide_user_id": sr.guide_user_id,
        "listing_id": sr.listing_id, "service_date": sr.service_date,
        "quoted_amount": float(sr.quoted_amount), "quoted_currency": sr.quoted_currency,
        "status": sr.status, "message": "Connection request sent!"
    }


@router.get("/mine")
async def list_my_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "guide":
        result = await db.execute(
            select(ServiceRequest).where(ServiceRequest.guide_user_id == current_user.id)
            .order_by(ServiceRequest.created_at.desc()).limit(50)
        )
    else:
        result = await db.execute(
            select(ServiceRequest).where(ServiceRequest.tourist_user_id == current_user.id)
            .order_by(ServiceRequest.created_at.desc()).limit(50)
        )
    requests = result.scalars().all()
    reviewed_request_ids: set[str] = set()
    if current_user.role == "tourist" and requests:
        review_result = await db.execute(
            select(Review.service_request_id).where(
                Review.reviewer_user_id == current_user.id,
                Review.service_request_id.in_([r.id for r in requests]),
            )
        )
        reviewed_request_ids = set(review_result.scalars().all())

    return [
        {"id": r.id, "tourist_user_id": r.tourist_user_id, "guide_user_id": r.guide_user_id,
         "listing_id": r.listing_id, "service_date": r.service_date,
         "service_time_hour": r.service_time_hour,
         "quoted_amount": float(r.quoted_amount), "quoted_currency": r.quoted_currency,
         "status": r.status, "party_size": r.party_size, "language": r.language,
         "tourist_notes": r.tourist_notes, "created_at": r.created_at,
         "has_review": r.id in reviewed_request_ids}
        for r in requests
    ]


@router.put("/{request_id}/accept")
async def accept_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_role(current_user, ["guide"])
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id, ServiceRequest.guide_user_id == current_user.id))
    sr = result.scalar_one_or_none()
    if not sr: raise HTTPException(status_code=404, detail="Request not found")
    if sr.status != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending requests")
    sr.status = "accepted"
    await db.flush()
    return {"message": "Request accepted"}


@router.put("/{request_id}/decline")
async def decline_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_role(current_user, ["guide"])
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id, ServiceRequest.guide_user_id == current_user.id))
    sr = result.scalar_one_or_none()
    if not sr: raise HTTPException(status_code=404, detail="Request not found")
    if sr.status != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending requests")
    sr.status = "cancelled_by_guide"
    await db.flush()
    return {"message": "Request declined"}


@router.put("/{request_id}/met")
async def mark_as_met(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Guide marks that they have met the tourist. This enables the tourist to write a review."""
    ensure_role(current_user, ["guide"])
    result = await db.execute(
        select(ServiceRequest).where(
            ServiceRequest.id == request_id,
            ServiceRequest.guide_user_id == current_user.id
        )
    )
    sr = result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Request not found")
    if sr.status not in ("accepted",):
        raise HTTPException(status_code=400, detail="Can only mark accepted requests as met")
    sr.status = "met"
    await db.flush()
    return {"message": "Service marked as met. Tourist can now write a review."}
