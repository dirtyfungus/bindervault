from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.trade import TradeOffer, TradeSchedule, OfferStatus
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()


class ScheduleRequest(BaseModel):
    lgs_name: Optional[str] = None
    lgs_address: Optional[str] = None
    scheduled_at: Optional[str] = None
    shipping_address: Optional[str] = None


@router.post("/{offer_id}")
async def create_or_update_schedule(
    offer_id: int,
    body: ScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = await db.scalar(
        select(TradeOffer).where(TradeOffer.id == offer_id, TradeOffer.status == OfferStatus.accepted)
    )
    if not offer:
        raise HTTPException(404, "Accepted offer not found")
    if offer.sender_id != current_user.id and offer.receiver_id != current_user.id:
        raise HTTPException(403, "Not your offer")

    existing = await db.scalar(select(TradeSchedule).where(TradeSchedule.offer_id == offer_id))
    scheduled_dt = datetime.fromisoformat(body.scheduled_at) if body.scheduled_at else None

    if existing:
        if body.lgs_name is not None:
            existing.lgs_name = body.lgs_name
        if body.lgs_address is not None:
            existing.lgs_address = body.lgs_address
        if scheduled_dt is not None:
            existing.scheduled_at = scheduled_dt
        if body.shipping_address is not None:
            existing.shipping_address = body.shipping_address
        await db.commit()
        return {"id": existing.id, "updated": True}

    schedule = TradeSchedule(
        offer_id=offer_id,
        lgs_name=body.lgs_name,
        lgs_address=body.lgs_address,
        scheduled_at=scheduled_dt,
        shipping_address=body.shipping_address,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return {"id": schedule.id}


@router.post("/{offer_id}/confirm")
async def confirm_schedule(
    offer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = await db.scalar(select(TradeOffer).where(TradeOffer.id == offer_id))
    if not offer:
        raise HTTPException(404, "Offer not found")
    schedule = await db.scalar(select(TradeSchedule).where(TradeSchedule.offer_id == offer_id))
    if not schedule:
        raise HTTPException(404, "No schedule yet")
    if current_user.id == offer.sender_id:
        schedule.confirmed_sender = True
    elif current_user.id == offer.receiver_id:
        schedule.confirmed_receiver = True
    else:
        raise HTTPException(403, "Not your trade")
    await db.commit()
    return {"confirmed_sender": schedule.confirmed_sender, "confirmed_receiver": schedule.confirmed_receiver}


@router.get("/{offer_id}")
async def get_schedule(offer_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    offer = await db.scalar(select(TradeOffer).where(TradeOffer.id == offer_id))
    if not offer or (offer.sender_id != current_user.id and offer.receiver_id != current_user.id):
        raise HTTPException(404, "Not found")
    schedule = await db.scalar(select(TradeSchedule).where(TradeSchedule.offer_id == offer_id))
    if not schedule:
        raise HTTPException(404, "No schedule yet")
    return {
        "id": schedule.id,
        "lgs_name": schedule.lgs_name,
        "lgs_address": schedule.lgs_address,
        "scheduled_at": schedule.scheduled_at,
        "shipping_address": schedule.shipping_address,
        "tracking_number": schedule.tracking_number,
        "confirmed_sender": schedule.confirmed_sender,
        "confirmed_receiver": schedule.confirmed_receiver,
    }
