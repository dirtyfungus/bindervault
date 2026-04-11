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

# 4. Open in browser
open http://localhost
```

First run takes ~2–3 minutes while images build and npm installs.

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

## Features (Phase 1)

- **Accounts** — Register/login with email + password. Discord-style `username#0000` handles. JWT auth (access + refresh tokens).
- **Trade binder** — Add cards via Scryfall search. Tracks condition (M/NM/LP/MP/HP/D), quantity, foil, price. Paginated grid with real card artwork.
- **Want list** — Mark cards you're hunting for.
- **Discover** — Search other users by username, browse their tradeable binder.
- **Trade offers** — Select a card you want + offer one or more cards from your binder + optional cash add-on. Choose LGS meetup or ship.
- **Counter offers** — Receiver can counter with different cards.
- **Scheduling** — After acceptance, set LGS name/address/time or shipping address. Both parties confirm.
- **Real-time notifications** — WebSocket push via Redis pub/sub. Toast notification on new offers/responses.
- **Price sync** — Background worker refreshes USD prices from Scryfall API every 6 hours.

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
| GET | `/scryfall/search?q=` | Search Scryfall cards |
| GET | `/scryfall/card/{id}` | Get card details |
| POST | `/trades/` | Create trade offer |
| GET | `/trades/incoming` | Incoming offers |
| GET | `/trades/outgoing` | Outgoing offers |
| GET | `/trades/history` | Completed/declined/cancelled |
| GET | `/trades/{id}` | Trade offer detail |
| POST | `/trades/{id}/respond` | Accept/decline/cancel/complete |
| POST | `/trades/{id}/counter` | Counter offer |
| POST | `/schedules/{offer_id}` | Create/update schedule |
| POST | `/schedules/{offer_id}/confirm` | Confirm meetup |
| GET | `/schedules/{offer_id}` | Get schedule |
| GET | `/notifications/` | Get notifications |
| POST | `/notifications/read-all` | Mark all read |
| WS | `/ws/notifications?token=` | Real-time notification stream |

Swagger UI: http://localhost/api/docs (via FastAPI auto-docs — update Nginx if you want to expose `/docs`)

---

## Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
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
| `POSTGRES_PASSWORD` | `bindervault_secret` | DB password — change this |
| `POSTGRES_DB` | `bindervault` | DB name |
| `SECRET_KEY` | *(must set)* | JWT signing key — `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token TTL |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `VITE_API_URL` | `/api` | Build-time API base URL |
| `VITE_WS_URL` | `ws://localhost/ws` | Build-time WebSocket URL |

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

# Rebuild a single service
docker compose up -d --build api

# Nuke everything (keeps code, destroys DB data)
docker compose down -v
```

---

## Phase 2 ideas

- Card condition photo uploads (stored in S3/Minio)
- LGS directory integration (Google Places API)
- In-app chat per trade thread
- Push notifications (PWA / mobile)
- Trade value calculator (auto-price-match)
- Collection stats and portfolio value tracking
- MTGGoldfish / EDHREC integration for format legality
- Mobile app (React Native, same API)

## TODO

- On the card offer, add an option to request extra money on the deal
- Add "Add friend" or "follow" to be able to quickly visualize your friend's binders
- Currently counter offer doesn't allow for editing the trade in any way + visuals are bugged a bit. 
- ~~We cannot accept the deal from the requesters' side, When the receiver accepts the trade, both users get stuck in limbo for this trade, since there's no way of the other user accepting/declining (Maybe auto accept from the requester side if there are no counter offers)~~
- Implement card reserve/warning when a card is already involved in a trade and someone wants another trade
- After accepting trade you cannot visualize the meetup information if you're the one requesting the trade
- ~~Implement trade specific chat as well as user to user chat~~
- Implement geolocation auto complete for my location and Meetup location
- Add "Use my location" as an alternative when signing up (Make it city specific, no actual address)
- On "Discover" be able to lookup specific cards available for trading
- Be able to mark cards as "not for trade" (This will hide the card from people looking at your profile, as well as the above)
- Implement Counter-offer options: When countering a trade, users can propose multiple alternative offers, each with its own set of cards/amounts. Countering is limited to modifying your own side of the trade, to change the other party's cards, a new trade must be initiated.
- ~~Notification icons don't go away~~



