"""Review endpoints — tourist reviews and guide replies."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import ensure_role, get_current_user
from app.core.database import get_db
from app.models.booking import ServiceRequest, Review
from app.models.user import GuideProfile, TouristProfile, User
from app.schemas.review import CreateReview, GuideReply, ReviewResponse, ReviewStats

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_review(
    req: CreateReview,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tourist submits a review for a guide.
    
    Requirements:
    - Service request must exist and belong to this tourist
    - Service request status must be 'met' (guide marked 'We have met')
    - Tourist cannot review the same service request twice
    """
    ensure_role(current_user, ["tourist"])
    # Verify service request exists and belongs to this tourist
    sr_result = await db.execute(
        select(ServiceRequest).where(
            ServiceRequest.id == req.service_request_id,
            ServiceRequest.tourist_user_id == current_user.id
        )
    )
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Check status is 'met'
    if sr.status != "met":
        raise HTTPException(
            status_code=400, 
            detail="Can only review after guide marks 'We have met'"
        )
    
    # Check if already reviewed
    existing = await db.execute(
        select(Review).where(
            Review.service_request_id == req.service_request_id,
            Review.reviewer_user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already reviewed this service")
    
    # Create review
    review = Review(
        service_request_id=req.service_request_id,
        reviewer_user_id=current_user.id,
        target_user_id=sr.guide_user_id,
        stars=req.stars,
        text=req.text,
    )
    db.add(review)
    await db.flush()
    
    # Update guide's rating stats
    stats_result = await db.execute(
        select(
            func.count(Review.id).label("count"),
            func.avg(Review.stars).label("avg")
        ).where(Review.target_user_id == sr.guide_user_id)
    )
    stats = stats_result.one()
    
    guide_result = await db.execute(
        select(GuideProfile).where(GuideProfile.user_id == sr.guide_user_id)
    )
    guide = guide_result.scalar_one_or_none()
    if guide:
        guide.rating_count = stats.count or 0
        guide.rating_avg = round(float(stats.avg or 0), 2)
        await db.flush()
    
    return {
        "id": review.id,
        "service_request_id": review.service_request_id,
        "reviewer_user_id": review.reviewer_user_id,
        "target_user_id": review.target_user_id,
        "stars": review.stars,
        "text": review.text,
        "guide_reply": review.guide_reply,
        "guide_replied_at": review.guide_replied_at,
        "created_at": review.created_at,
        "message": "Review submitted!"
    }


@router.get("/guide/{guide_user_id}")
async def get_guide_reviews(
    guide_user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get all reviews for a guide with statistics."""
    # Get reviews
    reviews_result = await db.execute(
        select(Review)
        .where(Review.target_user_id == guide_user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    reviews = reviews_result.scalars().all()
    
    # Get reviewer names
    review_list = []
    for r in reviews:
        reviewer_name = None
        tourist_result = await db.execute(
            select(TouristProfile.display_name).where(TouristProfile.user_id == r.reviewer_user_id)
        )
        reviewer_name = tourist_result.scalar_one_or_none()
        
        review_list.append({
            "id": r.id,
            "service_request_id": r.service_request_id,
            "reviewer_user_id": r.reviewer_user_id,
            "reviewer_name": reviewer_name,
            "target_user_id": r.target_user_id,
            "stars": r.stars,
            "text": r.text,
            "guide_reply": r.guide_reply,
            "guide_replied_at": r.guide_replied_at,
            "created_at": r.created_at,
        })
    
    # Calculate statistics
    stats_result = await db.execute(
        select(
            func.count(Review.id).label("total"),
            func.avg(Review.stars).label("avg"),
            func.sum(case((Review.stars == 5, 1), else_=0)).label("five"),
            func.sum(case((Review.stars == 4, 1), else_=0)).label("four"),
            func.sum(case((Review.stars == 3, 1), else_=0)).label("three"),
            func.sum(case((Review.stars == 2, 1), else_=0)).label("two"),
            func.sum(case((Review.stars == 1, 1), else_=0)).label("one"),
        ).where(Review.target_user_id == guide_user_id)
    )
    stats = stats_result.one()
    
    return {
        "reviews": review_list,
        "stats": {
            "total_reviews": stats.total or 0,
            "average_rating": round(float(stats.avg or 0), 2),
            "distribution": {
                "5": stats.five or 0,
                "4": stats.four or 0,
                "3": stats.three or 0,
                "2": stats.two or 0,
                "1": stats.one or 0,
            }
        }
    }


@router.put("/{review_id}/reply")
async def guide_reply_to_review(
    review_id: str,
    req: GuideReply,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Guide replies to a review.
    
    Requirements:
    - Review must exist
    - Guide must be the target of the review
    - Guide can only reply once (can update existing reply)
    """
    from datetime import datetime, timezone
    ensure_role(current_user, ["guide"])
    
    # Get review
    review_result = await db.execute(
        select(Review).where(Review.id == review_id)
    )
    review = review_result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Verify guide is the target
    if review.target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only reply to reviews about you")
    
    # Update reply
    review.guide_reply = req.reply_text
    review.guide_replied_at = datetime.now(timezone.utc).isoformat()
    await db.flush()
    
    return {
        "id": review.id,
        "guide_reply": review.guide_reply,
        "guide_replied_at": review.guide_replied_at,
        "message": "Reply saved!"
    }


@router.get("/mine")
async def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get reviews written by tourist or received by guide."""
    if current_user.role == "guide":
        result = await db.execute(
            select(Review)
            .where(Review.target_user_id == current_user.id)
            .order_by(Review.created_at.desc())
            .limit(50)
        )
    else:
        result = await db.execute(
            select(Review)
            .where(Review.reviewer_user_id == current_user.id)
            .order_by(Review.created_at.desc())
            .limit(50)
        )
    
    reviews = result.scalars().all()
    return [
        {
            "id": r.id,
            "service_request_id": r.service_request_id,
            "reviewer_user_id": r.reviewer_user_id,
            "target_user_id": r.target_user_id,
            "stars": r.stars,
            "text": r.text,
            "guide_reply": r.guide_reply,
            "guide_replied_at": r.guide_replied_at,
            "created_at": r.created_at,
        }
        for r in reviews
    ]
