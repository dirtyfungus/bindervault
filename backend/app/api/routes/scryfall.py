from fastapi import APIRouter, Depends, HTTPException, Query
import httpx

from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter()


@router.get("/search")
async def search_cards(q: str = Query(..., min_length=2), _=Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{settings.scryfall_api_base}/cards/search",
            params={"q": q, "unique": "cards", "order": "name"},
            timeout=10,
        )
    if r.status_code == 404:
        return {"data": [], "total_cards": 0}
    if r.status_code != 200:
        raise HTTPException(502, "Scryfall error")
    data = r.json()
    cards = [
        {
            "scryfall_id": c["id"],
            "card_name": c["name"],
            "set_code": c["set"],
            "set_name": c.get("set_name"),
            "collector_number": c.get("collector_number"),
            "rarity": c.get("rarity"),
            "image_uri": (
                c.get("image_uris", {}).get("normal")
                or (c.get("card_faces", [{}])[0].get("image_uris", {}).get("normal"))
            ),
            "price_usd": float(c["prices"]["usd"]) if c.get("prices", {}).get("usd") else None,
            "mana_cost": c.get("mana_cost") or c.get("card_faces", [{}])[0].get("mana_cost"),
            "type_line": c.get("type_line"),
        }
        for c in data.get("data", [])
    ]
    return {"data": cards, "total_cards": data.get("total_cards", len(cards))}


@router.get("/card/{scryfall_id}")
async def get_card(scryfall_id: str, _=Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{settings.scryfall_api_base}/cards/{scryfall_id}", timeout=10)
    if r.status_code == 404:
        raise HTTPException(404, "Card not found")
    c = r.json()
    return {
        "scryfall_id": c["id"],
        "card_name": c["name"],
        "set_code": c["set"],
        "set_name": c.get("set_name"),
        "rarity": c.get("rarity"),
        "image_uri": (
            c.get("image_uris", {}).get("normal")
            or (c.get("card_faces", [{}])[0].get("image_uris", {}).get("normal"))
        ),
        "price_usd": float(c["prices"]["usd"]) if c.get("prices", {}).get("usd") else None,
        "price_usd_foil": float(c["prices"]["usd_foil"]) if c.get("prices", {}).get("usd_foil") else None,
        "type_line": c.get("type_line"),
        "oracle_text": c.get("oracle_text"),
        "legalities": c.get("legalities"),
    }
