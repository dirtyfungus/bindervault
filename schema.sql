-- BinderVault complete schema

DO $$ BEGIN
    CREATE TYPE condition_enum AS ENUM ('M', 'NM', 'LP', 'MP', 'HP', 'D');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE offer_status_enum AS ENUM ('pending', 'countered', 'accepted', 'declined', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_method_enum AS ENUM ('lgs', 'ship');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    discriminator VARCHAR(4) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(64),
    bio TEXT,
    location VARCHAR(128),
    avatar_color VARCHAR(7),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    trade_count INTEGER NOT NULL DEFAULT 0,
    rating FLOAT NOT NULL DEFAULT 5.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS binder_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scryfall_id VARCHAR(36) NOT NULL,
    card_name VARCHAR(255) NOT NULL,
    set_code VARCHAR(10) NOT NULL,
    set_name VARCHAR(128),
    collector_number VARCHAR(16),
    rarity VARCHAR(16),
    image_uri TEXT,
    condition condition_enum NOT NULL DEFAULT 'NM',
    quantity INTEGER NOT NULL DEFAULT 1,
    foil BOOLEAN NOT NULL DEFAULT false,
    price_usd NUMERIC(10,2),
    notes TEXT,
    is_tradeable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS want_list_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scryfall_id VARCHAR(36) NOT NULL,
    card_name VARCHAR(255) NOT NULL,
    set_code VARCHAR(10),
    image_uri TEXT,
    max_condition condition_enum NOT NULL DEFAULT 'NM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_offers (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_entry_id INTEGER REFERENCES binder_entries(id),
    status offer_status_enum NOT NULL DEFAULT 'pending',
    delivery_method delivery_method_enum NOT NULL DEFAULT 'lgs',
    cash_add_on NUMERIC(10,2) NOT NULL DEFAULT 0,
    message TEXT,
    counter_of_id INTEGER REFERENCES trade_offers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_offer_items (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER REFERENCES trade_offers(id) ON DELETE CASCADE,
    binder_entry_id INTEGER REFERENCES binder_entries(id),
    card_name VARCHAR(255) NOT NULL,
    scryfall_id VARCHAR(36),
    quantity INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trade_schedules (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER REFERENCES trade_offers(id) ON DELETE CASCADE UNIQUE,
    lgs_name VARCHAR(255),
    lgs_address TEXT,
    scheduled_at TIMESTAMPTZ,
    shipping_address TEXT,
    tracking_number VARCHAR(128),
    confirmed_sender BOOLEAN NOT NULL DEFAULT false,
    confirmed_receiver BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    reference_id INTEGER,
    reference_type VARCHAR(64),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_messages (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER REFERENCES trade_offers(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);
CREATE INDEX IF NOT EXISTS ix_binder_entries_id ON binder_entries(id);
CREATE INDEX IF NOT EXISTS ix_binder_entries_user_id ON binder_entries(user_id);
CREATE INDEX IF NOT EXISTS ix_trade_offers_sender_id ON trade_offers(sender_id);
CREATE INDEX IF NOT EXISTS ix_trade_offers_receiver_id ON trade_offers(receiver_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_want_list_entries_user_id ON want_list_entries(user_id);
CREATE INDEX IF NOT EXISTS ix_trade_messages_offer_id ON trade_messages(offer_id);