"""Public explore endpoint — search published listings with guide info."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.listing import GuideListing
from app.models.user import GuideProfile

router = APIRouter(prefix="/explore", tags=["explore"])


@router.get("/listings")
async def search_listings(
    city: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search published guide listings. No auth required."""
    # First get all published listings
    query = select(GuideListing).where(GuideListing.status == "published")
    if city:
        query = query.where(GuideListing.city == city)

    result = await db.execute(query.order_by(GuideListing.created_at.desc()))
    all_listings = result.scalars().all()

    # Now fetch guide profiles for each listing
    listings_out = []
    for listing in all_listings:
        # Get guide profile
        gp_result = await db.execute(
            select(GuideProfile).where(GuideProfile.user_id == listing.guide_user_id)
        )
        guide = gp_result.scalar_one_or_none()
        if not guide:
            continue  # Skip listings without a guide profile

        # Language filter (check both listing and guide languages)
        if language:
            listing_langs = listing.languages if isinstance(listing.languages, list) else []
            guide_langs = guide.languages if isinstance(guide.languages, list) else []
            all_langs = listing_langs + guide_langs
            if language not in all_langs:
                continue

        listings_out.append({
            "id": listing.id,
            "title": listing.title,
            "summary": listing.summary,
            "description_md": listing.description_md,
            "city": listing.city,
            "price_amount": float(listing.price_amount),
            "price_currency": listing.price_currency,
            "price_unit": listing.price_unit,
            "cover_image_url": listing.cover_image_url,
            "images": listing.images if isinstance(listing.images, list) else [],
            "map_links": listing.map_links if isinstance(listing.map_links, list) else [],
            "views": listing.views or 0,
            "likes": listing.likes or 0,
            "created_at": listing.created_at,
            "languages": listing.languages if isinstance(listing.languages, list) else [],
            "tags": listing.tags if isinstance(listing.tags, list) else [],
            "guide": {
                "user_id": guide.user_id,
                "display_name": guide.display_name,
                "bio": guide.bio,
                "languages": guide.languages if isinstance(guide.languages, list) else [],
                "service_cities": guide.service_cities if isinstance(guide.service_cities, list) else [],
                "specialties": guide.specialties if isinstance(guide.specialties, list) else [],
                "rating_avg": float(guide.rating_avg or 0),
                "rating_count": guide.rating_count or 0,
                "default_rate_cny": float(guide.default_rate_cny or 0),
                "avatar_url": guide.avatar_url,
                "is_certified": guide.guide_license_no is not None and guide.guide_license_no != "",
                "accepts_cash": guide.accepts_cash,
                "payment_note": guide.payment_note,
            },
        })

    # Paginate
    total = len(listings_out)
    start = (page - 1) * per_page
    page_listings = listings_out[start:start + per_page]

    return {"listings": page_listings, "total": total, "page": page, "per_page": per_page}


@router.get("/listings/{listing_id}")
async def get_listing_detail(listing_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single listing with guide info. Increments view count."""
    result = await db.execute(
        select(GuideListing).where(GuideListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Increment view count
    listing.views = (listing.views or 0) + 1
    await db.flush()

    gp_result = await db.execute(
        select(GuideProfile).where(GuideProfile.user_id == listing.guide_user_id)
    )
    guide = gp_result.scalar_one_or_none()

    return {
        "id": listing.id, "title": listing.title, "summary": listing.summary,
        "description_md": listing.description_md, "city": listing.city,
        "price_amount": float(listing.price_amount), "price_currency": listing.price_currency,
        "price_unit": listing.price_unit, "cover_image_url": listing.cover_image_url,
        "images": listing.images if isinstance(listing.images, list) else [],
        "map_links": listing.map_links if isinstance(listing.map_links, list) else [],
        "views": listing.views or 0,
        "likes": listing.likes or 0,
        "created_at": listing.created_at,
        "languages": listing.languages if isinstance(listing.languages, list) else [],
        "guide": {
            "user_id": guide.user_id if guide else "", "display_name": guide.display_name if guide else "Guide",
            "bio": guide.bio if guide else "", "languages": guide.languages if guide and isinstance(guide.languages, list) else [],
            "service_cities": guide.service_cities if guide and isinstance(guide.service_cities, list) else [],
            "specialties": guide.specialties if guide and isinstance(guide.specialties, list) else [],
            "rating_avg": float(guide.rating_avg or 0) if guide else 0,
            "rating_count": guide.rating_count or 0 if guide else 0,
            "is_certified": bool(guide and guide.guide_license_no),
            "accepts_cash": guide.accepts_cash if guide else True,
            "payment_note": guide.payment_note if guide else "",
        } if guide else {"user_id": "", "display_name": "Guide", "bio": "", "languages": [], "service_cities": [], "specialties": [], "rating_avg": 0, "rating_count": 0, "is_certified": False, "accepts_cash": True, "payment_note": ""},
    }
