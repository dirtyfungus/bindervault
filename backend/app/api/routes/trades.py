from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
import json

from app.db.session import get_db
from app.models.trade import TradeOffer, TradeOfferItem, OfferStatus, DeliveryMethod, Notification
from app.models.binder import BinderEntry
from app.models.user import User
from app.core.security import get_current_user
from app.core.redis import get_redis

router = APIRouter()


async def _transfer_one(entry: BinderEntry, new_owner_id: int, db: AsyncSession):
    if entry.quantity > 1:
        entry.quantity -= 1
        existing = await db.scalar(
            select(BinderEntry).where(
                BinderEntry.user_id == new_owner_id,
                BinderEntry.scryfall_id == entry.scryfall_id,
                BinderEntry.condition == entry.condition,
                BinderEntry.foil == entry.foil,
            )
        )
        if existing:
            existing.quantity += 1
        else:
            db.add(BinderEntry(
                user_id=new_owner_id,
                scryfall_id=entry.scryfall_id,
                card_name=entry.card_name,
                set_code=entry.set_code,
                set_name=entry.set_name,
                collector_number=entry.collector_number,
                rarity=entry.rarity,
                image_uri=entry.image_uri,
                condition=entry.condition,
                quantity=1,
                foil=entry.foil,
                price_usd=entry.price_usd,
            ))
    else:
        entry.user_id = new_owner_id


def offer_out(offer: TradeOffer):
    return {
        "id": offer.id,
        "sender_id": offer.sender_id,
        "receiver_id": offer.receiver_id,
        "sender": {
            "id": offer.sender.id,
            "handle": offer.sender.handle,
            "display_name": offer.sender.display_name,
            "avatar_color": offer.sender.avatar_color,
            "rating": offer.sender.rating,
        } if offer.sender else None,
        "receiver": {
            "id": offer.receiver.id,
            "handle": offer.receiver.handle,
            "display_name": offer.receiver.display_name,
            "avatar_color": offer.receiver.avatar_color,
        } if offer.receiver else None,
        "target_entry": {
            "id": offer.target_entry.id,
            "card_name": offer.target_entry.card_name,
            "scryfall_id": offer.target_entry.scryfall_id,
            "image_uri": offer.target_entry.image_uri,
            "price_usd": float(offer.target_entry.price_usd) if offer.target_entry and offer.target_entry.price_usd else None,
        } if offer.target_entry else None,
        "offered_items": [
            {
                "id": i.id,
                "binder_entry_id": i.binder_entry_id,
                "card_name": i.card_name,
                "scryfall_id": i.scryfall_id,
                "quantity": i.quantity,
            }
            for i in offer.offered_items
        ],
        "status": offer.status,
        "delivery_method": offer.delivery_method,
        "cash_add_on": float(offer.cash_add_on) if offer.cash_add_on else 0.0,
        "message": offer.message,
        "counter_of_id": offer.counter_of_id,
        "created_at": offer.created_at,
        "updated_at": offer.updated_at,
    }


async def _load_offer(offer_id: int, db: AsyncSession) -> TradeOffer:
    result = await db.execute(
        select(TradeOffer)
        .options(
            selectinload(TradeOffer.sender),
            selectinload(TradeOffer.receiver),
            selectinload(TradeOffer.target_entry),
            selectinload(TradeOffer.offered_items),
        )
        .where(TradeOffer.id == offer_id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(404, "Trade offer not found")
    return offer


async def _notify(db: AsyncSession, user_id: int, notif_type: str, title: str, body: str, ref_id: int):
    notif = Notification(
        user_id=user_id, type=notif_type, title=title, body=body,
        reference_id=ref_id, reference_type="trade_offer",
    )
    db.add(notif)
    await db.flush()

    redis = get_redis()
    if redis:
        payload = json.dumps({"type": notif_type, "title": title, "body": body, "reference_id": ref_id})
        await redis.publish(f"user:{user_id}:notifications", payload)


class CreateOfferRequest(BaseModel):
    receiver_id: int
    target_entry_id: int
    offered_entry_ids: list[int]
    cash_add_on: float = 0.0
    delivery_method: DeliveryMethod = DeliveryMethod.lgs
    message: Optional[str] = None


class RespondRequest(BaseModel):
    action: str
    message: Optional[str] = None


class CounterRequest(BaseModel):
    offered_entry_ids: list[int]
    cash_add_on: float = 0.0
    delivery_method: DeliveryMethod = DeliveryMethod.lgs
    message: Optional[str] = None


@router.post("/", status_code=201)
async def create_offer(
    body: CreateOfferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.receiver_id == current_user.id:
        raise HTTPException(400, "Cannot trade with yourself")

    target = await db.scalar(
        select(BinderEntry).where(
            BinderEntry.id == body.target_entry_id,
            BinderEntry.user_id == body.receiver_id,
            BinderEntry.is_tradeable == True,
        )
    )
    if not target:
        raise HTTPException(404, "Target card not found or not tradeable")

    offered_entries = []
    for eid in body.offered_entry_ids:
        entry = await db.scalar(
            select(BinderEntry).where(BinderEntry.id == eid, BinderEntry.user_id == current_user.id)
        )
        if not entry:
            raise HTTPException(404, f"Your binder entry {eid} not found")
        offered_entries.append(entry)

    offer = TradeOffer(
        sender_id=current_user.id,
        receiver_id=body.receiver_id,
        target_entry_id=body.target_entry_id,
        cash_add_on=body.cash_add_on,
        delivery_method=body.delivery_method,
        message=body.message,
    )
    db.add(offer)
    await db.flush()

    for entry in offered_entries:
        db.add(TradeOfferItem(
            offer_id=offer.id,
            binder_entry_id=entry.id,
            card_name=entry.card_name,
            scryfall_id=entry.scryfall_id,
            quantity=1,
        ))

    await _notify(
        db, body.receiver_id, "new_offer",
        "New trade offer",
        f"{current_user.handle} wants your {target.card_name}",
        offer.id,
    )
    await db.commit()
    return await _load_offer(offer.id, db)


@router.get("/incoming")
async def incoming_offers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TradeOffer)
        .options(
            selectinload(TradeOffer.sender),
            selectinload(TradeOffer.receiver),
            selectinload(TradeOffer.target_entry),
            selectinload(TradeOffer.offered_items),
        )
        .where(
            TradeOffer.receiver_id == current_user.id,
            TradeOffer.status.in_([OfferStatus.pending, OfferStatus.countered, OfferStatus.accepted]),
        )
        .order_by(TradeOffer.created_at.desc())
    )
    return [offer_out(o) for o in result.scalars().all()]


@router.get("/outgoing")
async def outgoing_offers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TradeOffer)
        .options(
            selectinload(TradeOffer.sender),
            selectinload(TradeOffer.receiver),
            selectinload(TradeOffer.target_entry),
            selectinload(TradeOffer.offered_items),
        )
        .where(
            TradeOffer.sender_id == current_user.id,
            TradeOffer.status.in_([OfferStatus.pending, OfferStatus.countered, OfferStatus.accepted]),
        )
        .order_by(TradeOffer.created_at.desc())
    )
    return [offer_out(o) for o in result.scalars().all()]


@router.get("/history")
async def trade_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TradeOffer)
        .options(
            selectinload(TradeOffer.sender),
            selectinload(TradeOffer.receiver),
            selectinload(TradeOffer.target_entry),
            selectinload(TradeOffer.offered_items),
        )
        .where(
            or_(TradeOffer.sender_id == current_user.id, TradeOffer.receiver_id == current_user.id),
            TradeOffer.status.in_([OfferStatus.completed, OfferStatus.declined, OfferStatus.cancelled]),
        )
        .order_by(TradeOffer.updated_at.desc())
        .limit(50)
    )
    return [offer_out(o) for o in result.scalars().all()]


@router.get("/{offer_id}")
async def get_offer(
    offer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = await _load_offer(offer_id, db)
    if offer.sender_id != current_user.id and offer.receiver_id != current_user.id:
        raise HTTPException(403, "Not your offer")
    return offer_out(offer)


@router.post("/{offer_id}/respond")
async def respond_to_offer(
    offer_id: int,
    body: RespondRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = await _load_offer(offer_id, db)

    if body.action == "accept":
        # Receiver accepts a pending offer, OR original sender accepts a counter
        if offer.status == OfferStatus.pending:
            if offer.receiver_id != current_user.id:
                raise HTTPException(403, "Only the receiver can accept a pending offer")
        elif offer.status == OfferStatus.countered:
            if offer.sender_id != current_user.id:
                raise HTTPException(403, "Only the original sender can accept a counter offer")
        else:
            raise HTTPException(400, "Offer cannot be accepted in its current state")
        offer.status = OfferStatus.accepted
        notify_id = offer.sender_id if offer.receiver_id == current_user.id else offer.receiver_id
        await _notify(
            db, notify_id, "offer_accepted", "Trade accepted!",
            f"Your offer for {offer.target_entry.card_name if offer.target_entry else 'a card'} was accepted",
            offer.id,
        )

    elif body.action == "decline":
        # Either party can decline
        if offer.sender_id != current_user.id and offer.receiver_id != current_user.id:
            raise HTTPException(403, "Not part of this trade")
        if offer.status not in [OfferStatus.pending, OfferStatus.countered]:
            raise HTTPException(400, "Cannot decline in current state")
        offer.status = OfferStatus.declined
        if body.message:
            offer.message = f"[Declined] {body.message}"
        notify_id = offer.sender_id if offer.receiver_id == current_user.id else offer.receiver_id
        await _notify(
            db, notify_id, "offer_declined", "Trade declined",
            f"Your offer for {offer.target_entry.card_name if offer.target_entry else 'a card'} was declined",
            offer.id,
        )

    elif body.action == "cancel":
        if offer.sender_id != current_user.id:
            raise HTTPException(403, "Only the sender can cancel")
        offer.status = OfferStatus.cancelled

    elif body.action == "complete":
        if offer.sender_id != current_user.id and offer.receiver_id != current_user.id:
            raise HTTPException(403, "Not your offer")
        if offer.status != OfferStatus.accepted:
            raise HTTPException(400, "Offer must be accepted before completing")
        offer.status = OfferStatus.completed
        sender = await db.scalar(select(User).where(User.id == offer.sender_id))
        receiver = await db.scalar(select(User).where(User.id == offer.receiver_id))
        if sender:
            sender.trade_count += 1
        if receiver:
            receiver.trade_count += 1
        is_counter = offer.counter_of_id is not None
        target_dest = offer.receiver_id if is_counter else offer.sender_id
        if offer.target_entry_id:
            target = await db.scalar(select(BinderEntry).where(BinderEntry.id == offer.target_entry_id))
            if target:
                await _transfer_one(target, target_dest, db)
        for item in offer.offered_items:
            if item.binder_entry_id:
                entry = await db.scalar(select(BinderEntry).where(BinderEntry.id == item.binder_entry_id))
                if entry:
                    await _transfer_one(entry, offer.receiver_id, db)

    else:
        raise HTTPException(400, "Invalid action")

    await db.commit()
    return await _load_offer(offer_id, db)


@router.post("/{offer_id}/counter")
async def counter_offer(
    offer_id: int,
    body: CounterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = await _load_offer(offer_id, db)

    is_receiver = original.receiver_id == current_user.id
    is_sender = original.sender_id == current_user.id

    if not is_receiver and not is_sender:
        raise HTTPException(403, "Not part of this trade")

    if original.status == OfferStatus.pending and not is_receiver:
        raise HTTPException(403, "Only the receiver can counter a pending offer")

    if original.status == OfferStatus.countered and not is_sender:
        raise HTTPException(403, "Only the original sender can counter back")

    if original.status not in [OfferStatus.pending, OfferStatus.countered]:
        raise HTTPException(400, "Can only counter pending or countered offers")

    original.status = OfferStatus.countered

    # New counter: swap sender/receiver
    counter = TradeOffer(
        sender_id=current_user.id,
        receiver_id=original.sender_id if is_receiver else original.receiver_id,
        target_entry_id=original.target_entry_id,
        cash_add_on=body.cash_add_on,
        delivery_method=body.delivery_method,
        message=body.message,
        counter_of_id=original.id,
    )
    db.add(counter)
    await db.flush()

    for eid in body.offered_entry_ids:
        entry = await db.scalar(
            select(BinderEntry).where(BinderEntry.id == eid, BinderEntry.user_id == current_user.id)
        )
        if entry:
            db.add(TradeOfferItem(
                offer_id=counter.id,
                binder_entry_id=entry.id,
                card_name=entry.card_name,
                scryfall_id=entry.scryfall_id,
                quantity=1,
            ))

    notify_user_id = original.sender_id if is_receiver else original.receiver_id
    await _notify(
        db, notify_user_id, "counter_offer",
        "Counter offer received",
        f"{current_user.handle} sent a counter offer",
        counter.id,
    )
    await db.commit()
    return await _load_offer(counter.id, db)