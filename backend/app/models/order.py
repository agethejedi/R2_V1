from sqlalchemy import String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    internal_order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    exchange_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    asset: Mapped[str] = mapped_column(String(20), index=True)
    mode: Mapped[str] = mapped_column(String(20))
    side: Mapped[str] = mapped_column(String(10))
    order_type: Mapped[str] = mapped_column(String(20))
    requested_notional_usd: Mapped[float] = mapped_column(Float)
    requested_quantity: Mapped[float] = mapped_column(Float)
    filled_quantity: Mapped[float] = mapped_column(Float, default=0.0)
    average_fill_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    fee_usd: Mapped[float] = mapped_column(Float, default=0.0)
    slippage_usd: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    strategy_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    exit_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    opened_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Fill(Base, TimestampMixin):
    __tablename__ = "fills"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_internal_id: Mapped[str] = mapped_column(String(64), index=True)
    order_exchange_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    asset: Mapped[str] = mapped_column(String(20), index=True)
    side: Mapped[str] = mapped_column(String(10))
    fill_quantity: Mapped[float] = mapped_column(Float)
    fill_price: Mapped[float] = mapped_column(Float)
    fee_usd: Mapped[float] = mapped_column(Float, default=0.0)
    liquidity_indicator: Mapped[str | None] = mapped_column(String(50), nullable=True)
    trade_time: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Position(Base, TimestampMixin):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset: Mapped[str] = mapped_column(String(20), index=True)
    mode: Mapped[str] = mapped_column(String(20), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    average_entry_price: Mapped[float] = mapped_column(Float, default=0.0)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    stop_loss_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    entry_order_internal_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    exit_order_internal_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="flat")
