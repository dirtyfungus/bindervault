# BinderVault

MTG trade binder platform — portfolio-style card listings, Discord-style user handles, trade offer flow with card + cash sweeteners, and LGS/shipping scheduling.

---

## Quick start

```bash
# 1. Clone / copy this project folder
cd bindervault

# 2. Create your .env
cp .env.example .env
# Edit SECRET_KEY — generate one with: openssl rand -hex 32

# 3. Bring it up
docker compose up -d --build

# 4. Fix passlib/bcrypt compatibility (required after every --no-cache build)
docker compose exec api pip install passlib bcrypt==4.0.1

# 5. Open in browser
open http://localhost
```

First run takes ~2–3 minutes while images build and npm installs.

> **Note:** If the API fails to start due to an Alembic migration conflict, run:
> ```bash
> docker compose exec -T db psql -U bindervault bindervault -c "DELETE FROM alembic_version; INSERT INTO alembic_version VALUES ('0002');"
> docker compose restart api
> ```

---

## Architecture

```
┌─────────────┐   ┌──────────────┐   ┌────────────────┐
│  React/Vite │──▶│    Nginx     │──▶│   FastAPI API  │
│  (frontend) │   │  :80 / proxy │   │   :8000        │
└─────────────┘   └──────────────┘   └────────┬───────┘
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                       ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
                       │  PostgreSQL │  │    Redis    │  │  Worker    │
                       │  :5432      │  │  :6379      │  │ (price sync)│
                       └─────────────┘  └─────────────┘  └────────────┘
```

**Services:**
| Container | Purpose |
|---|---|
| `bindervault_frontend` | React app, served by Nginx. Proxies `/api/*` → FastAPI |
| `bindervault_api` | FastAPI backend, Alembic migrations on startup |
| `bindervault_db` | PostgreSQL 16 — persistent via Docker volume |
| `bindervault_redis` | Pub/sub for real-time WebSocket notifications |
| `bindervault_worker` | Background job: refreshes Scryfall prices every 6h |

---

## Features (Current)

- **Accounts** — Register/login with email + password. Discord-style `username#0000` handles. JWT auth (access + refresh tokens).
- **Trade binder** — Add cards via Scryfall search (all printings: alt art, extended, showcase, borderless, foil). Tracks condition, quantity, foil, price. Paginated grid with real card artwork.
- **Multi-select** — Click cards to select multiple, bulk remove with confirmation dialog. "Don't show again" option persists to localStorage.
- **Deck import** — Import from Moxfield/Archidekt URLs or paste plain text deck lists. Preview with per-card checkboxes. Handles smart apostrophes and Unicode normalization. Duplicate handling: increment qty or skip.
- **Want list / Wishlist** — Track cards you're hunting for. Shown as a separate tab on your binder and other users' profiles.
- **Discover** — Search other users by username, browse their tradeable binder and wishlist.
- **Trade offers** — Select a card you want + offer cards from your binder + optional cash add-on. Choose LGS meetup or ship.
- **Trade chat** — Per-trade messaging with 2s polling. Notifications fire on both sides when a message is sent.
- **Card reserve warnings** — Cards involved in active trades show an ⚠ IN TRADE badge. Clicking navigates to the trade.
- **Counter offers** — Receiver can counter with different cards from their binder.
- **Decline with reason** — Receiver can decline a trade and provide a reason shown to the other party.
- **Scheduling** — After acceptance, set LGS name/address/time or shipping address. Both parties confirm.
- **Real-time notifications** — WebSocket push via Redis pub/sub. Bell icon with unread count and dropdown. Marks all read on open.
- **Beta disclaimer** — Modal shown on first login explaining the app is in early beta.
- **Price sync** — Background worker refreshes USD prices from Scryfall every 6 hours.

---

## API reference

All routes under `/api/`. Auth required (Bearer token) except `/api/auth/register` and `/api/auth/login`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user profile |
| GET | `/users/search?q=` | Search users by username |
| GET | `/users/{id}` | User profile |
| GET | `/users/{id}/wants` | Public wishlist for a user |
| PATCH | `/users/me` | Update profile |
| POST | `/users/{id}/follow` | Follow user |
| DELETE | `/users/{id}/follow` | Unfollow user |
| GET | `/binder/` | Your binder (paginated) |
| GET | `/binder/user/{id}` | Another user's binder |
| POST | `/binder/` | Add card to binder |
| PATCH | `/binder/{id}` | Update card entry |
| DELETE | `/binder/{id}` | Remove card |
| GET | `/binder/wants` | Your want list |
| POST | `/binder/wants` | Add to want list |
| DELETE | `/binder/wants/{id}` | Remove from want list |
| GET | `/binder/import/fetch-deck?url=` | Proxy fetch Moxfield/Archidekt deck |
| POST | `/binder/import` | Bulk import cards to binder |
| GET | `/scryfall/search?q=` | Search Scryfall cards (all printings) |
| GET | `/scryfall/card/{id}` | Get card details |
| POST | `/trades/` | Create trade offer |
| GET | `/trades/incoming` | Incoming offers |
| GET | `/trades/outgoing` | Outgoing offers |
| GET | `/trades/history` | Completed/declined/cancelled |
| GET | `/trades/{id}` | Trade offer detail |
| POST | `/trades/{id}/respond` | Accept/decline/cancel/complete |
| POST | `/trades/{id}/counter` | Counter offer |
| GET | `/trades/{id}/messages` | Trade chat messages |
| POST | `/trades/{id}/messages` | Send trade chat message |
| POST | `/schedules/{offer_id}` | Create/update schedule |
| POST | `/schedules/{offer_id}/confirm` | Confirm meetup |
| GET | `/schedules/{offer_id}` | Get schedule |
| GET | `/notifications/` | Get notifications |
| POST | `/notifications/read-all` | Mark all read |
| WS | `/ws/notifications?token=` | Real-time notification stream |

Swagger UI available at `http://localhost/api/docs`

---

## Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install passlib bcrypt==4.0.1  # pin bcrypt for passlib compatibility
# Set DATABASE_URL and REDIS_URL in your shell or .env
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on :5173, proxies /api to :8000
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `bindervault` | DB username |
| `POSTGRES_PASSWORD` | `bindervault_secret` | DB password — change in production |
| `POSTGRES_DB` | `bindervault` | DB name |
| `SECRET_KEY` | *(must set)* | JWT signing key — `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token TTL |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `VITE_API_URL` | `/api` | Build-time API base URL |
| `VITE_WS_URL` | `ws://localhost/ws` | Build-time WebSocket URL |

---

## Known gotchas

- **bcrypt version** — `passlib==1.7.4` is incompatible with `bcrypt>=5.x`. Always pin `bcrypt==4.0.1`. The volume mount `./backend:/app` means pip installs don't persist across `--no-cache` rebuilds.
- **PowerShell redirect** — PowerShell doesn't support `<` for stdin redirect. Use `Get-Content file | docker compose exec -T ...` instead.
- **Alembic conflicts** — If `trade_messages` table already exists, manually set the migration version: `DELETE FROM alembic_version; INSERT INTO alembic_version VALUES ('0002');`
- **SQLAlchemy enums** — Python enum names vs values differ. Use `values_callable=lambda x: [e.value for e in x]` on enum columns.

---

## Useful commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f frontend

# Run DB migrations after model changes
docker compose exec api alembic revision --autogenerate -m "description"
docker compose exec api alembic upgrade head

# Connect to DB
docker compose exec db psql -U bindervault bindervault

# Inject schema manually (PowerShell)
Get-Content schema.sql | docker compose exec -T db psql -U bindervault bindervault

# Fix passlib after no-cache rebuild
docker compose exec api pip install passlib bcrypt==4.0.1

# Rebuild a single service
docker compose up -d --build api

# Nuke everything (keeps code, destroys DB data)
docker compose down -v
```

---

## TODO

- Add "Add friend" or "follow" to quickly visualize friends' binders
- Counter offer: allow editing trade cards + fix visual bugs
- Geolocation autocomplete for location and meetup location fields
- "Use my location" on signup (city-level only)
- Discover page: search for specific cards available for trading across all users
- Counter-offer options: propose multiple alternatives, limited to own side of trade
- Fix chat sender visibility — messages not showing on sender's side
- Fix chat delivery — currently relies on 2s poll, explore WebSocket push

## DONE

- ~~Multi-select cards in binder with bulk remove + confirm dialog~~
- ~~Deck import from Moxfield/Archidekt URLs and plain text~~
- ~~Show all card printings in search (alt art, extended, showcase, borderless)~~
- ~~Wishlist tab on binder page and user profile page~~
- ~~Beta disclaimer modal on login~~
- ~~Trade chat with real-time notifications~~
- ~~Decline trade with reason~~
- ~~Card reserve/warning when card is in active trade~~
- ~~Card right-click context menu~~
- ~~Mark cards as not for trade~~
- ~~Notification bell with unread count, marks all read on open~~
- ~~Trade offer with cash sweetener~~
- ~~Auto-accept from requester side when no counter offers~~
- ~~Meetup/scheduling info visible to both parties~~