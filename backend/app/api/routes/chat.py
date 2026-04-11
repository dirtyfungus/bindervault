# backend/app/api/routes/chat.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import json

from app.db.session import get_db
from app.models.trade import TradeMessage, TradeOffer
from app.models.user import User
from app.core.security import get_current_user
from app.core.redis import get_redis

router = APIRouter()


def msg_out(m: TradeMessage):
    return {
        "id": m.id,
        "offer_id": m.offer_id,
        "sender_id": m.sender_id,
        "sender_handle": m.sender.handle if m.sender else None,
        "sender_avatar_color": m.sender.avatar_color if m.sender else None,
        "body": m.body,
        "is_read": m.is_read,
        "created_at": m.created_at.isoformat(),
    }


@router.get("/{offer_id}/messages")
async def get_messages(
    offer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify user is part of this trade
    result = await db.execute(select(TradeOffer).where(TradeOffer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(404, "Trade not found")
    if current_user.id not in (offer.sender_id, offer.receiver_id):
        raise HTTPException(403, "Not part of this trade")

    # Mark messages as read
    msgs_result = await db.execute(
        select(TradeMessage).where(
            and_(
                TradeMessage.offer_id == offer_id,
                TradeMessage.sender_id != current_user.id,
                TradeMessage.is_read == False,
            )
        )
    )
    for msg in msgs_result.scalars().all():
        msg.is_read = True
    await db.commit()

    # Fetch latest 500 messages
    all_msgs = await db.execute(
        select(TradeMessage)
        .where(TradeMessage.offer_id == offer_id)
        .options(selectinload(TradeMessage.sender))
        .order_by(TradeMessage.created_at.desc())
        .limit(500)
    )
    return list(reversed([msg_out(m) for m in all_msgs.scalars().all()]))


class SendMessageRequest(BaseModel):
    body: str


@router.post("/{offer_id}/messages", status_code=201)
async def send_message(
    offer_id: int,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify user is part of this trade
    result = await db.execute(select(TradeOffer).where(TradeOffer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(404, "Trade not found")
    if current_user.id not in (offer.sender_id, offer.receiver_id):
        raise HTTPException(403, "Not part of this trade")

    msg = TradeMessage(
        offer_id=offer_id,
        sender_id=current_user.id,
        body=body.body.strip(),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Reload with relationship
    full = await db.execute(
        select(TradeMessage).where(TradeMessage.id == msg.id).options(selectinload(TradeMessage.sender))
    )
    msg = full.scalar_one()

    # Push real-time event to the other user via Redis
    other_id = offer.receiver_id if current_user.id == offer.sender_id else offer.sender_id
    redis = get_redis()
    if redis:
        payload = json.dumps({
            "type": "trade_message",
            "offer_id": offer_id,
            "message": msg_out(msg),
        })
        await redis.publish(f"user:{other_id}:notifications", payload)

    # Create a DB notification so the bell lights up
    from app.api.routes.trades import _notify
    await _notify(
        db, other_id, "trade_message", "New message",
        f"{current_user.handle} sent you a message on Trade #{offer_id}",
        offer_id,
    )

    return msg_out(msg)