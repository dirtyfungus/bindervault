"""add trade_messages table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trade_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("offer_id", sa.Integer(), sa.ForeignKey("trade_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trade_messages_id", "trade_messages", ["id"], unique=False)
    op.create_index("ix_trade_messages_offer_id", "trade_messages", ["offer_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_trade_messages_offer_id", table_name="trade_messages")
    op.drop_index("ix_trade_messages_id", table_name="trade_messages")
    op.drop_table("trade_messages")
