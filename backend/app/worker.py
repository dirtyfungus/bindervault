"""
Background worker: periodic Scryfall price refresh for binder entries.
Runs as a separate container.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.binder import BinderEntry
from app.core.redis import init_redis

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("worker")


async def refresh_prices():
    log.info("Starting price refresh...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(distinct(BinderEntry.scryfall_id)))
        scryfall_ids = [row[0] for row in result.fetchall()]

    log.info(f"Refreshing prices for {len(scryfall_ids)} unique cards")

    async with httpx.AsyncClient() as client:
        for scryfall_id in scryfall_ids:
            try:
                r = await client.get(
                    f"https://api.scryfall.com/cards/{scryfall_id}",
                    timeout=8,
                )
                if r.status_code == 200:
                    data = r.json()
                    price = data.get("prices", {}).get("usd")
                    if price:
                        async with AsyncSessionLocal() as db:
                            entries = await db.execute(
                                select(BinderEntry).where(BinderEntry.scryfall_id == scryfall_id)
                            )
                            for entry in entries.scalars().all():
                                entry.price_usd = float(price)
                            await db.commit()
                # Be polite to Scryfall — max 10 req/sec
                await asyncio.sleep(0.12)
            except Exception as e:
                log.warning(f"Failed to refresh {scryfall_id}: {e}")

    log.info("Price refresh complete")


async def main():
    await init_redis()

    scheduler = AsyncIOScheduler()
    # Run price refresh every 6 hours
    scheduler.add_job(refresh_prices, "interval", hours=6, next_run_time=datetime.now(timezone.utc))
    scheduler.start()

    log.info("Worker started. Price refresh every 6 hours.")
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
