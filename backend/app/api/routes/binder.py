from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.binder import BinderEntry, WantListEntry, Condition
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()


def normalize_name(name: str) -> str:
    """Normalize card name for matching - straighten apostrophes and strip whitespace."""
    return (
        name
        .replace('\u2019', "'")  # right single quotation mark
        .replace('\u2018', "'")  # left single quotation mark
        .replace('\u201c', '"')  # left double quotation mark
        .replace('\u201d', '"')  # right double quotation mark
        .strip()
        .lower()
    )


def entry_out(e: BinderEntry, active_offer_id: int | None = None):
    return {
        "id": e.id,
        "user_id": e.user_id,
        "scryfall_id": e.scryfall_id,
        "card_name": e.card_name,
        "set_code": e.set_code,
        "set_name": e.set_name,
        "collector_number": e.collector_number,
        "rarity": e.rarity,
        "image_uri": e.image_uri,
        "condition": e.condition,
        "quantity": e.quantity,
        "foil": e.foil,
        "price_usd": float(e.price_usd) if e.price_usd else None,
        "notes": e.notes,
        "is_tradeable": e.is_tradeable,
        "active_offer_id": active_offer_id,
        "created_at": e.created_at,
        "updated_at": e.updated_at,
    }


class AddCardRequest(BaseModel):
    scryfall_id: str
    card_name: str
    set_code: str
    set_name: Optional[str] = None
    collector_number: Optional[str] = None
    rarity: Optional[str] = None
    image_uri: Optional[str] = None
    condition: Condition = Condition.near_mint
    quantity: int = 1
    foil: bool = False
    price_usd: Optional[float] = None
    notes: Optional[str] = None
    is_tradeable: bool = True


class UpdateCardRequest(BaseModel):
    condition: Optional[Condition] = None
    quantity: Optional[int] = None
    foil: Optional[bool] = None
    price_usd: Optional[float] = None
    notes: Optional[str] = None
    is_tradeable: Optional[bool] = None


class ImportCardItem(BaseModel):
    card_name: str
    quantity: int = 1
    set_code: Optional[str] = None


class ImportRequest(BaseModel):
    cards: list[ImportCardItem]
    on_duplicate: str = "increment"  # "increment" or "skip"


@router.get("/")
async def get_my_binder(
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    search: Optional[str] = None,
    rarity: Optional[str] = None,
    tradeable_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_binder(current_user.id, page, per_page, search, rarity, tradeable_only, db)


@router.get("/user/{user_id}")
async def get_user_binder(
    user_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    search: Optional[str] = None,
    rarity: Optional[str] = None,
    tradeable_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await _get_binder(user_id, page, per_page, search, rarity, tradeable_only, db)


async def _get_binder(user_id, page, per_page, search, rarity, tradeable_only, db):
    from app.models.trade import TradeOffer, TradeOfferItem

    q = select(BinderEntry).where(BinderEntry.user_id == user_id)
    if search:
        q = q.where(BinderEntry.card_name.ilike(f"%{search}%"))
    if rarity:
        q = q.where(BinderEntry.rarity == rarity)
    if tradeable_only:
        q = q.where(BinderEntry.is_tradeable == True)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    q = q.order_by(BinderEntry.card_name).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    entries = result.scalars().all()

    entry_ids = [e.id for e in entries]
    active_offer_map: dict[int, int] = {}

    if entry_ids:
        offered_result = await db.execute(
            select(TradeOfferItem.binder_entry_id, TradeOffer.id)
            .join(TradeOffer, TradeOfferItem.offer_id == TradeOffer.id)
            .where(
                TradeOfferItem.binder_entry_id.in_(entry_ids),
                TradeOffer.status.in_(["pending", "accepted"]),
            )
        )
        for binder_entry_id, offer_id in offered_result.all():
            active_offer_map[binder_entry_id] = offer_id

        target_result = await db.execute(
            select(TradeOffer.target_entry_id, TradeOffer.id)
            .where(
                TradeOffer.target_entry_id.in_(entry_ids),
                TradeOffer.status.in_(["pending", "accepted"]),
            )
        )
        for target_entry_id, offer_id in target_result.all():
            if target_entry_id not in active_offer_map:
                active_offer_map[target_entry_id] = offer_id

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "items": [entry_out(e, active_offer_map.get(e.id)) for e in entries],
    }


@router.post("/", status_code=201)
async def add_card(
    body: AddCardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(BinderEntry).where(
            BinderEntry.user_id == current_user.id,
            BinderEntry.scryfall_id == body.scryfall_id,
            BinderEntry.condition == body.condition,
            BinderEntry.foil == body.foil,
        )
    )
    entry = existing.scalar_one_or_none()
    if entry:
        entry.quantity += body.quantity
        await db.commit()
        await db.refresh(entry)
        return entry_out(entry)

    entry = BinderEntry(user_id=current_user.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry_out(entry)


@router.patch("/{entry_id}")
async def update_card(
    entry_id: int,
    body: UpdateCardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BinderEntry).where(BinderEntry.id == entry_id, BinderEntry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry_out(entry)


@router.delete("/{entry_id}", status_code=204)
async def delete_card(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BinderEntry).where(BinderEntry.id == entry_id, BinderEntry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    await db.delete(entry)
    await db.commit()


@router.get("/import/fetch-deck")
async def fetch_deck(url: str = Query(...), _=Depends(get_current_user)):
    import httpx, re

    mox = re.search(r'moxfield\.com/decks/([A-Za-z0-9_-]+)', url)
    arch = re.search(r'archidekt\.com/decks/(\d+)', url)

    async with httpx.AsyncClient() as client:
        if mox:
            r = await client.get(
                f"https://api.moxfield.com/v2/decks/all/{mox.group(1)}",
                timeout=15,
                headers={"User-Agent": "BinderVault/1.0"},
            )
            if not r.is_success:
                raise HTTPException(502, "Could not fetch Moxfield deck")
            data = r.json()
            cards = []
            for section in ["mainboard", "sideboard", "commanders", "companions"]:
                for card in data.get(section, {}).values():
                    cards.append({
                        "card_name": card["card"]["name"],
                        "quantity": card["quantity"],
                        "set_code": card["card"].get("set", "").lower() or None,
                    })
            return {"cards": cards}

        elif arch:
            r = await client.get(
                f"https://archidekt.com/api/decks/{arch.group(1)}/small/",
                timeout=15,
                headers={"User-Agent": "BinderVault/1.0"},
            )
            if not r.is_success:
                raise HTTPException(502, "Could not fetch Archidekt deck")
            data = r.json()
            cards = []
            for card in data.get("cards", []):
                cards.append({
                    "card_name": card["card"]["oracleCard"]["name"],
                    "quantity": card["quantity"],
                    "set_code": card["card"].get("edition", {}).get("editioncode", "").lower() or None,
                })
            return {"cards": cards}

        else:
            raise HTTPException(400, "Unrecognized URL. Paste a Moxfield or Archidekt deck URL.")


@router.post("/import")
async def import_cards(
    body: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import httpx
    import asyncio

    results = []
    cards_to_add = []

    async with httpx.AsyncClient() as client:
        chunks = [body.cards[i:i+75] for i in range(0, len(body.cards), 75)]

        for chunk in chunks:
            # Normalize names before sending to Scryfall
            identifiers = [{"name": normalize_name(item.card_name)} for item in chunk]

            r = await client.post(
                "https://api.scryfall.com/cards/collection",
                json={"identifiers": identifiers},
                timeout=30,
                headers={"Content-Type": "application/json"},
            )
            await asyncio.sleep(0.1)

            if r.status_code != 200:
                for item in chunk:
                    results.append({"card_name": item.card_name, "status": "not_found"})
                continue

            data = r.json()

            # Build name->card map using normalized names
            found_by_name = {
                normalize_name(c["name"]): c
                for c in data.get("data", [])
            }
            # Also index by card face names (double-faced cards)
            for c in data.get("data", []):
                for face in c.get("card_faces", []):
                    face_key = normalize_name(face.get("name", ""))
                    if face_key and face_key not in found_by_name:
                        found_by_name[face_key] = c

            for item in chunk:
                key = normalize_name(item.card_name)
                if key in found_by_name:
                    cards_to_add.append((item, found_by_name[key]))
                else:
                    results.append({"card_name": item.card_name, "status": "not_found"})

    # Step 2: Add found cards to binder
    for item, c in cards_to_add:
        scryfall_id = c["id"]
        image_uri = (
            c.get("image_uris", {}).get("normal")
            or (c.get("card_faces", [{}])[0].get("image_uris", {}).get("normal"))
        )
        price_usd = float(c["prices"]["usd"]) if c.get("prices", {}).get("usd") else None

        existing = await db.execute(
            select(BinderEntry).where(
                BinderEntry.user_id == current_user.id,
                BinderEntry.scryfall_id == scryfall_id,
                BinderEntry.condition == "NM",
                BinderEntry.foil == False,
            )
        )
        entry = existing.scalar_one_or_none()

        if entry:
            if body.on_duplicate == "increment":
                entry.quantity += item.quantity
                await db.commit()
                results.append({"card_name": item.card_name, "status": "incremented", "quantity": entry.quantity})
            else:
                results.append({"card_name": item.card_name, "status": "skipped"})
        else:
            new_entry = BinderEntry(
                user_id=current_user.id,
                scryfall_id=scryfall_id,
                card_name=c["name"],
                set_code=c["set"],
                set_name=c.get("set_name"),
                collector_number=c.get("collector_number"),
                rarity=c.get("rarity"),
                image_uri=image_uri,
                price_usd=price_usd,
                condition="NM",
                quantity=item.quantity,
                foil=False,
                is_tradeable=True,
            )
            db.add(new_entry)
            await db.commit()
            results.append({
                "card_name": item.card_name,
                "status": "added",
                "image_uri": image_uri,
                "scryfall_id": scryfall_id,
            })

    return {"results": results}


# ---- Want list ----

@router.get("/wants")
async def get_wants(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(WantListEntry).where(WantListEntry.user_id == current_user.id))
    return [
        {"id": w.id, "scryfall_id": w.scryfall_id, "card_name": w.card_name,
         "set_code": w.set_code, "image_uri": w.image_uri, "max_condition": w.max_condition}
        for w in result.scalars().all()
    ]


class AddWantRequest(BaseModel):
    scryfall_id: str
    card_name: str
    set_code: Optional[str] = None
    image_uri: Optional[str] = None
    max_condition: Condition = Condition.near_mint


@router.post("/wants", status_code=201)
async def add_want(
    body: AddWantRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = WantListEntry(user_id=current_user.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "card_name": entry.card_name}


@router.delete("/wants/{want_id}", status_code=204)
async def delete_want(
    want_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WantListEntry).where(WantListEntry.id == want_id, WantListEntry.user_id == current_user.id)
    )
    want = result.scalar_one_or_none()
    if not want:
        raise HTTPException(404, "Not found")
    await db.delete(want)
    await db.commit()