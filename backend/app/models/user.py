import random
import string
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


def generate_discriminator():
    return "".join(random.choices(string.digits, k=4))


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    discriminator: Mapped[str] = mapped_column(String(4), nullable=False, default=generate_discriminator)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(64), nullable=True)
    bio: Mapped[str] = mapped_column(Text, nullable=True)
    location: Mapped[str] = mapped_column(String(128), nullable=True)
    avatar_color: Mapped[str] = mapped_column(String(7), nullable=True, default="#00d4c8")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    trade_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(default=5.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    binder_entries = relationship("BinderEntry", back_populates="user", cascade="all, delete-orphan")
    sent_offers = relationship("TradeOffer", foreign_keys="TradeOffer.sender_id", back_populates="sender")
    received_offers = relationship("TradeOffer", foreign_keys="TradeOffer.receiver_id", back_populates="receiver")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    want_list = relationship("WantListEntry", back_populates="user", cascade="all, delete-orphan")

    followers = relationship(
        "UserFollow",
        foreign_keys="UserFollow.following_id",
        back_populates="following_user",
    )
    following = relationship(
        "UserFollow",
        foreign_keys="UserFollow.follower_id",
        back_populates="follower_user",
    )

    @property
    def handle(self):
        return f"{self.username}#{self.discriminator}"


class UserFollow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (UniqueConstraint("follower_id", "following_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follower_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    following_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    follower_user = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following_user = relationship("User", foreign_keys=[following_id], back_populates="followers")
