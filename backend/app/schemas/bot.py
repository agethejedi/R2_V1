from typing import Literal
from pydantic import BaseModel, Field

TradingMode = Literal['paper', 'live', 'paused']
Aggressiveness = Literal['conservative', 'balanced', 'aggressive']
ModeSetting = Literal['manual', 'bot']


class BotSettingsUpdate(BaseModel):
    active_asset: str
    trading_mode: TradingMode
    live_switch_enabled: bool
    kill_switch_enabled: bool
    aggressiveness: Aggressiveness
    trade_amount_mode: ModeSetting
    profit_target_mode: ModeSetting
    max_trade_amount_usd: float = Field(gt=0)
    max_loss_per_trade_usd: float = Field(gt=0)
    desired_profit_per_trade_usd: float = Field(gt=0)
    max_daily_loss_usd: float = Field(gt=0)
    min_entry_interval_seconds: int = Field(ge=5)
    ema_filter_enabled: bool
    relative_strength_filter_enabled: bool


class BotSettingsRead(BotSettingsUpdate):
    id: int

    class Config:
        from_attributes = True


class BotStatusRead(BaseModel):
    state: str
    websocket_connected: bool
    user_websocket_connected: bool
    rest_connected: bool
    heartbeat_age_seconds: float
    last_signal: str | None
    last_message: str | None
    active_asset: str
    trading_mode: str
    live_switch_enabled: bool
    kill_switch_enabled: bool
    regime: str | None = None
    regime_confidence: str | None = None
    regime_posture: str | None = None
    market_summary: str | None = None
    bot_posture: str | None = None
    decision_summary: str | None = None
    position_summary: str | None = None
    risk_summary: str | None = None
    signal_score: float | None = None
    entry_eligible: bool | None = None
    price: float | None = None
    vwap: float | None = None
    ema20: float | None = None
    ema50: float | None = None
    spread_bps: float | None = None
    relative_strength_fast: float | None = None
    relative_strength_slow: float | None = None
    open_position_qty: float | None = None
    unrealized_pnl: float | None = None
