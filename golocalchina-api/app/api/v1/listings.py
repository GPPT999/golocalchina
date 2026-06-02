"""Guide Listing CRUD — guides create and manage their service offerings."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import ensure_role, get_current_user
from app.core.database import get_db
from app.models.listing import GuideListing
from app.models.user import User

router = APIRouter(prefix="/listings", tags=["listings"])


class CreateListing(BaseModel):
    title: str = Field(min_length=5, max_length=160)
    summary: str = Field(min_length=10, max_length=500)
    description_md: str = Field(min_length=20)
    city: str
    languages: list[str] = []
    price_amount: float = Field(gt=0)
    price_currency: str = "CNY"
    price_unit: str = "per_half_day"
    max_group_size: int = Field(default=8, ge=1, le=30)
    tags: list[str] = []
    cover_image_url: Optional[str] = None
    images: list[str] = []  # Additional images
    map_links: list[str] = []  # Map links (Google Maps, Baidu Maps, etc.)


class UpdateListing(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    description_md: Optional[str] = None
    city: Optional[str] = None
    languages: Optional[list[str]] = None
    price_amount: Optional[float] = None
    price_currency: Optional[str] = None
    price_unit: Optional[str] = None
    max_group_size: Optional[int] = None
    tags: Optional[list[str]] = None
    cover_image_url: Optional[str] = None
    images: Optional[list[str]] = None
    map_links: Optional[list[str]] = None
    status: Optional[str] = None  # draft, published, paused


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_listing(
    req: CreateListing,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new guide service listing."""
    ensure_role(current_user, ["guide"])
    listing = GuideListing(
        guide_user_id=current_user.id,
        title=req.title, summary=req.summary, description_md=req.description_md,
        city=req.city, languages=req.languages,
        price_amount=req.price_amount, price_currency=req.price_currency, price_unit=req.price_unit,
        max_group_size=req.max_group_size, tags=req.tags, cover_image_url=req.cover_image_url,
        images=req.images, map_links=req.map_links,
        status="published",
    )
    db.add(listing)
    await db.flush()
    return {"id": listing.id, "title": listing.title, "status": listing.status, "message": "Listing created"}


@router.get("/mine")
async def list_my_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all listings for a guide."""
    ensure_role(current_user, ["guide"])
    result = await db.execute(
        select(GuideListing).where(GuideListing.guide_user_id == current_user.id)
        .order_by(GuideListing.created_at.desc())
    )
    listings = result.scalars().all()
    return [
        {"id": l.id, "title": l.title, "summary": l.summary, "city": l.city,
         "price_amount": float(l.price_amount), "price_currency": l.price_currency,
         "price_unit": l.price_unit, "status": l.status, "cover_image_url": l.cover_image_url,
         "views_count": l.views or 0, "likes_count": l.likes or 0,
         "created_at": l.created_at}
        for l in listings
    ]


@router.put("/{listing_id}")
async def update_listing(
    listing_id: str,
    req: UpdateListing,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_role(current_user, ["guide"])
    result = await db.execute(
        select(GuideListing).where(GuideListing.id == listing_id, GuideListing.guide_user_id == current_user.id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(listing, field, value)
    await db.flush()
    return {"message": "Listing updated"}


@router.delete("/{listing_id}")
async def delete_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_role(current_user, ["guide"])
    result = await db.execute(
        select(GuideListing).where(GuideListing.id == listing_id, GuideListing.guide_user_id == current_user.id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    await db.delete(listing)
    await db.flush()
    return {"message": "Listing deleted"}


@router.post("/{listing_id}/like")
async def like_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Like a listing (toggle)."""
    result = await db.execute(
        select(GuideListing).where(GuideListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Simple increment (in production, track per-user likes)
    listing.likes = (listing.likes or 0) + 1
    await db.flush()
    return {"likes_count": listing.likes, "message": "Liked!"}


@router.post("/{listing_id}/unlike")
async def unlike_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlike a listing (toggle)."""
    result = await db.execute(
        select(GuideListing).where(GuideListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    listing.likes = max(0, (listing.likes or 0) - 1)
    await db.flush()
    return {"likes_count": listing.likes, "message": "Unliked!"}
