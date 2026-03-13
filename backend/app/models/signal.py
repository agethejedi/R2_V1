from sqlalchemy import String, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SignalLog(Base, TimestampMixin):
    __tablename__ = 'signal_logs'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset: Mapped[str] = mapped_column(String(20), index=True)
    aggressiveness: Mapped[str] = mapped_column(String(20))
    setup_type: Mapped[str] = mapped_column(String(50))
    recommendation: Mapped[str] = mapped_column(String(20))
    composite_score: Mapped[float] = mapped_column(Float)
    vwap_score: Mapped[float] = mapped_column(Float, default=0)
    orderbook_score: Mapped[float] = mapped_column(Float, default=0)
    tradeflow_score: Mapped[float] = mapped_column(Float, default=0)
    momentum_score: Mapped[float] = mapped_column(Float, default=0)
    spread_score: Mapped[float] = mapped_column(Float, default=0)
    volume_score: Mapped[float] = mapped_column(Float, default=0)
    ema_score: Mapped[float] = mapped_column(Float, default=0)
    rs_score: Mapped[float] = mapped_column(Float, default=0)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
