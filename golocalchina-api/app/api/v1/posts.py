"""Tourist Posts — tourists can create, view, and manage posts."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import ensure_role, get_current_user
from app.core.database import get_db
from app.models.post import TouristPost, PostLike
from app.models.user import User, TouristProfile

router = APIRouter(prefix="/posts", tags=["posts"])


class CreatePost(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    content: str = Field(min_length=10)
    images: list[str] = []


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(
    req: CreatePost,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tourist post."""
    ensure_role(current_user, ["tourist"])
    post = TouristPost(
        author_user_id=current_user.id,
        title=req.title,
        content=req.content,
        images=req.images,
        is_done=False,
        view_count=0,
        like_count=0,
    )
    db.add(post)
    await db.flush()
    return {"id": post.id, "title": post.title, "message": "Post created"}


async def get_author_info(db: AsyncSession, author_user_id: str) -> dict:
    """Helper to get author display info."""
    user_result = await db.execute(
        select(User).where(User.id == author_user_id)
    )
    author = user_result.scalar_one_or_none()
    
    if not author:
        return {"user_id": "", "display_name": "Anonymous"}
    
    # Try to get tourist profile display name
    profile_result = await db.execute(
        select(TouristProfile).where(TouristProfile.user_id == author_user_id)
    )
    profile = profile_result.scalar_one_or_none()
    
    display_name = profile.display_name if profile else (author.email or "Anonymous")
    
    return {
        "user_id": author.id,
        "display_name": display_name,
    }


@router.get("")
async def list_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """List all posts with author info."""
    result = await db.execute(
        select(TouristPost).order_by(TouristPost.created_at.desc())
    )
    all_posts = result.scalars().all()

    posts_out = []
    for post in all_posts:
        author = await get_author_info(db, post.author_user_id)
        display_title = f"[DONE] {post.title}" if post.is_done else post.title

        posts_out.append({
            "id": post.id,
            "title": display_title,
            "content": post.content,
            "images": post.images if isinstance(post.images, list) else [],
            "is_done": post.is_done,
            "view_count": post.view_count or 0,
            "like_count": post.like_count or 0,
            "created_at": post.created_at,
            "author": author,
        })

    total = len(posts_out)
    start = (page - 1) * per_page
    page_posts = posts_out[start:start + per_page]

    return {"posts": page_posts, "total": total, "page": page, "per_page": per_page}


@router.get("/liked")
async def list_liked_posts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List post IDs liked by the authenticated user."""
    result = await db.execute(
        select(PostLike.post_id).where(PostLike.user_id == current_user.id)
    )
    return {"liked_post_ids": [row[0] for row in result.all()]}


@router.get("/{post_id}")
async def get_post(post_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single post with author info. Increments view count."""
    result = await db.execute(
        select(TouristPost).where(TouristPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Increment view count
    post.view_count = (post.view_count or 0) + 1
    await db.flush()

    author = await get_author_info(db, post.author_user_id)
    display_title = f"[DONE] {post.title}" if post.is_done else post.title

    return {
        "id": post.id,
        "title": display_title,
        "content": post.content,
        "images": post.images if isinstance(post.images, list) else [],
        "is_done": post.is_done,
        "view_count": post.view_count,
        "like_count": post.like_count or 0,
        "created_at": post.created_at,
        "author": author,
    }


@router.post("/{post_id}/like")
async def like_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Like or unlike a post. Toggles like status."""
    # Check post exists
    result = await db.execute(
        select(TouristPost).where(TouristPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check if already liked
    like_result = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )
    existing_like = like_result.scalar_one_or_none()

    if existing_like:
        # Unlike
        await db.delete(existing_like)
        post.like_count = max(0, (post.like_count or 0) - 1)
        await db.flush()
        return {"liked": False, "like_count": post.like_count}
    else:
        # Like
        new_like = PostLike(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        post.like_count = (post.like_count or 0) + 1
        await db.flush()
        return {"liked": True, "like_count": post.like_count}


@router.get("/{post_id}/liked")
async def check_liked(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if user has liked a post."""
    result = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )
    return {"liked": result.scalar_one_or_none() is not None}


@router.put("/{post_id}/done")
async def mark_post_done(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a post as done. Only the author can do this."""
    result = await db.execute(
        select(TouristPost).where(
            TouristPost.id == post_id,
            TouristPost.author_user_id == current_user.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or not authorized")

    post.is_done = True
    await db.flush()
    return {"message": "Post marked as done"}


@router.delete("/{post_id}")
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a post. Only the author can do this."""
    result = await db.execute(
        select(TouristPost).where(
            TouristPost.id == post_id,
            TouristPost.author_user_id == current_user.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or not authorized")

    await db.delete(post)
    await db.flush()
    return {"message": "Post deleted"}
