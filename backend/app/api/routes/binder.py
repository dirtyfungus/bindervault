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


def entry_out(e: BinderEntry):
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

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "items": [entry_out(e) for e in entries],
    }


@router.post("/", status_code=201)
async def add_card(
    body: AddCardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if same scryfall_id + condition already exists for this user
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
