from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user import User, UserFollow
from app.models.binder import BinderEntry
from app.core.security import get_current_user

router = APIRouter()


def user_public(user: User, binder_count: int = 0, follower_count: int = 0, following_count: int = 0):
    return {
        "id": user.id,
        "username": user.username,
        "discriminator": user.discriminator,
        "handle": user.handle,
        "display_name": user.display_name,
        "bio": user.bio,
        "location": user.location,
        "avatar_color": user.avatar_color,
        "is_verified": user.is_verified,
        "trade_count": user.trade_count,
        "rating": round(user.rating, 1),
        "binder_count": binder_count,
        "follower_count": follower_count,
        "following_count": following_count,
        "created_at": user.created_at,
    }


@router.get("/search")
async def search_users(q: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(User).where(User.username.ilike(f"%{q}%")).limit(20)
    )
    users = result.scalars().all()
    return [user_public(u) for u in users]


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    binder_count = await db.scalar(select(func.count()).where(BinderEntry.user_id == user_id))
    follower_count = await db.scalar(select(func.count()).where(UserFollow.following_id == user_id))
    following_count = await db.scalar(select(func.count()).where(UserFollow.follower_id == user_id))

    return user_public(user, binder_count or 0, follower_count or 0, following_count or 0)


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    location: str | None = None
    avatar_color: str | None = None


@router.patch("/me")
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.bio is not None:
        current_user.bio = body.bio
    if body.location is not None:
        current_user.location = body.location
    if body.avatar_color is not None:
        current_user.avatar_color = body.avatar_color
    await db.commit()
    return {"ok": True}


@router.post("/{user_id}/follow")
async def follow_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot follow yourself")
    existing = await db.execute(
        select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.following_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Already following")
    follow = UserFollow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)
    await db.commit()
    return {"ok": True}


@router.delete("/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.following_id == user_id)
    )
    follow = result.scalar_one_or_none()
    if not follow:
        raise HTTPException(404, "Not following")
    await db.delete(follow)
    await db.commit()
    return {"ok": True}
