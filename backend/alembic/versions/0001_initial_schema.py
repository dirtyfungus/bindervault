"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(32), nullable=False),
        sa.Column("discriminator", sa.String(4), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(64), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("location", sa.String(128), nullable=True),
        sa.Column("avatar_color", sa.String(7), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("trade_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rating", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_follows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("follower_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("following_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("follower_id", "following_id"),
    )

    condition_enum = sa.Enum("M", "NM", "LP", "MP", "HP", "D", name="condition_enum")
    condition_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "binder_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scryfall_id", sa.String(36), nullable=False),
        sa.Column("card_name", sa.String(255), nullable=False),
        sa.Column("set_code", sa.String(10), nullable=False),
        sa.Column("set_name", sa.String(128), nullable=True),
        sa.Column("collector_number", sa.String(16), nullable=True),
        sa.Column("rarity", sa.String(16), nullable=True),
        sa.Column("image_uri", sa.Text(), nullable=True),
        sa.Column("condition", condition_enum, nullable=False, server_default="NM"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("foil", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("price_usd", sa.Numeric(10, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_tradeable", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_binder_entries_id", "binder_entries", ["id"], unique=False)
    op.create_index("ix_binder_entries_user_id", "binder_entries", ["user_id"], unique=False)

    op.create_table(
        "want_list_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scryfall_id", sa.String(36), nullable=False),
        sa.Column("card_name", sa.String(255), nullable=False),
        sa.Column("set_code", sa.String(10), nullable=True),
        sa.Column("image_uri", sa.Text(), nullable=True),
        sa.Column("max_condition", condition_enum, nullable=False, server_default="NM"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_want_list_entries_user_id", "want_list_entries", ["user_id"], unique=False)

    offer_status_enum = sa.Enum(
        "pending", "countered", "accepted", "declined", "cancelled", "completed",
        name="offer_status_enum"
    )
    offer_status_enum.create(op.get_bind(), checkfirst=True)

    delivery_enum = sa.Enum("lgs", "ship", name="delivery_method_enum")
    delivery_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "trade_offers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("receiver_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_entry_id", sa.Integer(), sa.ForeignKey("binder_entries.id"), nullable=True),
        sa.Column("status", offer_status_enum, nullable=False, server_default="pending"),
        sa.Column("delivery_method", delivery_enum, nullable=False, server_default="lgs"),
        sa.Column("cash_add_on", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("counter_of_id", sa.Integer(), sa.ForeignKey("trade_offers.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trade_offers_sender_id", "trade_offers", ["sender_id"], unique=False)
    op.create_index("ix_trade_offers_receiver_id", "trade_offers", ["receiver_id"], unique=False)

    op.create_table(
        "trade_offer_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("offer_id", sa.Integer(), sa.ForeignKey("trade_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("binder_entry_id", sa.Integer(), sa.ForeignKey("binder_entries.id"), nullable=True),
        sa.Column("card_name", sa.String(255), nullable=False),
        sa.Column("scryfall_id", sa.String(36), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "trade_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("offer_id", sa.Integer(), sa.ForeignKey("trade_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lgs_name", sa.String(255), nullable=True),
        sa.Column("lgs_address", sa.Text(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shipping_address", sa.Text(), nullable=True),
        sa.Column("tracking_number", sa.String(128), nullable=True),
        sa.Column("confirmed_sender", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("confirmed_receiver", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("offer_id"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("reference_type", sa.String(64), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("trade_schedules")
    op.drop_table("trade_offer_items")
    op.drop_table("trade_offers")
    op.drop_table("want_list_entries")
    op.drop_table("binder_entries")
    op.drop_table("user_follows")
    op.drop_table("users")
    sa.Enum(name="offer_status_enum").drop(op.get_bind())
    sa.Enum(name="delivery_method_enum").drop(op.get_bind())
    sa.Enum(name="condition_enum").drop(op.get_bind())