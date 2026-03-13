from sqlalchemy import String, Float, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class BotSetting(Base, TimestampMixin):
    __tablename__ = 'bot_settings'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    active_asset: Mapped[str] = mapped_column(String(20), default='ETH-USD')
    trading_mode: Mapped[str] = mapped_column(String(20), default='paper')
    live_switch_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    kill_switch_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    aggressiveness: Mapped[str] = mapped_column(String(20), default='balanced')
    trade_amount_mode: Mapped[str] = mapped_column(String(20), default='manual')
    profit_target_mode: Mapped[str] = mapped_column(String(20), default='manual')
    max_trade_amount_usd: Mapped[float] = mapped_column(Float, default=100.0)
    max_loss_per_trade_usd: Mapped[float] = mapped_column(Float, default=10.0)
    desired_profit_per_trade_usd: Mapped[float] = mapped_column(Float, default=15.0)
    max_daily_loss_usd: Mapped[float] = mapped_column(Float, default=30.0)
    min_entry_interval_seconds: Mapped[int] = mapped_column(Integer, default=60)
    ema_filter_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    relative_strength_filter_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class BotState(Base, TimestampMixin):
    __tablename__ = 'bot_state'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(30), default='standby')
    websocket_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    user_websocket_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    rest_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    heartbeat_age_seconds: Mapped[float] = mapped_column(Float, default=999.0)
    last_signal: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
