from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric, Text, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.db.session import Base


class OfferStatus(str, enum.Enum):
    pending = "pending"
    countered = "countered"
    accepted = "accepted"
    declined = "declined"
    cancelled = "cancelled"
    completed = "completed"


class DeliveryMethod(str, enum.Enum):
    lgs = "lgs"
    ship = "ship"


class TradeOffer(Base):
    __tablename__ = "trade_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    receiver_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # Cards the receiver is giving up (what sender wants)
    target_entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("binder_entries.id"), nullable=True)

    status: Mapped[str] = mapped_column(
        Enum(OfferStatus, name="offer_status_enum"),
        default=OfferStatus.pending,
        nullable=False,
    )
    delivery_method: Mapped[str] = mapped_column(
        Enum(DeliveryMethod, name="delivery_method_enum"),
        default=DeliveryMethod.lgs,
        nullable=False,
    )
    cash_add_on: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    message: Mapped[str] = mapped_column(Text, nullable=True)
    counter_of_id: Mapped[int] = mapped_column(Integer, ForeignKey("trade_offers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_offers")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_offers")
    target_entry = relationship("BinderEntry", foreign_keys=[target_entry_id])
    offered_items = relationship("TradeOfferItem", back_populates="offer", cascade="all, delete-orphan")
    schedule = relationship("TradeSchedule", back_populates="offer", uselist=False)
    counter_of = relationship("TradeOffer", remote_side="TradeOffer.id", foreign_keys=[counter_of_id])


class TradeOfferItem(Base):
    """Cards the sender is offering in return."""
    __tablename__ = "trade_offer_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    offer_id: Mapped[int] = mapped_column(Integer, ForeignKey("trade_offers.id", ondelete="CASCADE"))
    binder_entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("binder_entries.id"), nullable=True)
    # Snapshot in case entry is removed
    card_name: Mapped[str] = mapped_column(String(255), nullable=False)
    scryfall_id: Mapped[str] = mapped_column(String(36), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    offer = relationship("TradeOffer", back_populates="offered_items")
    binder_entry = relationship("BinderEntry", back_populates="offer_items")


class TradeSchedule(Base):
    __tablename__ = "trade_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    offer_id: Mapped[int] = mapped_column(Integer, ForeignKey("trade_offers.id", ondelete="CASCADE"), unique=True)
    lgs_name: Mapped[str] = mapped_column(String(255), nullable=True)
    lgs_address: Mapped[str] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    shipping_address: Mapped[str] = mapped_column(Text, nullable=True)
    tracking_number: Mapped[str] = mapped_column(String(128), nullable=True)
    confirmed_sender: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_receiver: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    offer = relationship("TradeOffer", back_populates="schedule")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=True)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=True)
    reference_type: Mapped[str] = mapped_column(String(64), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")


class TradeMessage(Base):
    __tablename__ = "trade_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    offer_id: Mapped[int] = mapped_column(Integer, ForeignKey("trade_offers.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sender = relationship("User", foreign_keys=[sender_id])
    offer = relationship("TradeOffer", foreign_keys=[offer_id])