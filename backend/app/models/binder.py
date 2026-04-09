from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.db.session import Base


class Condition(str, enum.Enum):
    mint = "M"
    near_mint = "NM"
    lightly_played = "LP"
    moderately_played = "MP"
    heavily_played = "HP"
    damaged = "D"


class BinderEntry(Base):
    __tablename__ = "binder_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scryfall_id: Mapped[str] = mapped_column(String(36), nullable=False)
    card_name: Mapped[str] = mapped_column(String(255), nullable=False)
    set_code: Mapped[str] = mapped_column(String(10), nullable=False)
    set_name: Mapped[str] = mapped_column(String(128), nullable=True)
    collector_number: Mapped[str] = mapped_column(String(16), nullable=True)
    rarity: Mapped[str] = mapped_column(String(16), nullable=True)
    image_uri: Mapped[str] = mapped_column(Text, nullable=True)
    condition: Mapped[str] = mapped_column(
        Enum(Condition, name="condition_enum"),
        default=Condition.near_mint,
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    foil: Mapped[bool] = mapped_column(default=False)
    price_usd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    is_tradeable: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="binder_entries")
    offer_items = relationship("TradeOfferItem", back_populates="binder_entry")


class WantListEntry(Base):
    __tablename__ = "want_list_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scryfall_id: Mapped[str] = mapped_column(String(36), nullable=False)
    card_name: Mapped[str] = mapped_column(String(255), nullable=False)
    set_code: Mapped[str] = mapped_column(String(10), nullable=True)
    image_uri: Mapped[str] = mapped_column(Text, nullable=True)
    max_condition: Mapped[str] = mapped_column(
        Enum(Condition, name="condition_enum"),
        default=Condition.near_mint,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="want_list")
