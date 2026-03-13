from __future__ import annotations

from dataclasses import dataclass
from math import floor

from app.models.bot import BotSetting
from app.services.indicators import IndicatorBundle
from app.services.strategy import StrategyDecision


@dataclass
class RiskResult:
    allowed: bool
    quantity: float
    notional_usd: float
    reason: str | None


SIZE_FACTOR = {
    'conservative': 0.35,
    'balanced': 0.6,
    'aggressive': 0.9,
}


def evaluate_risk(settings: BotSetting, asset: str, ind: IndicatorBundle, decision: StrategyDecision, daily_realized_loss_usd: float = 0.0, position_open: bool = False, heartbeat_age_seconds: float | None = None) -> RiskResult:
    if decision.recommendation != 'enter_long':
        return RiskResult(False, 0.0, 0.0, 'no_entry_signal')
    if settings.kill_switch_enabled:
        return RiskResult(False, 0.0, 0.0, 'kill_switch_enabled')
    if settings.trading_mode == 'paused':
        return RiskResult(False, 0.0, 0.0, 'paused')
    if settings.trading_mode == 'live' and not settings.live_switch_enabled:
        return RiskResult(False, 0.0, 0.0, 'live_switch_off')
    if position_open:
        return RiskResult(False, 0.0, 0.0, 'position_already_open')
    if daily_realized_loss_usd >= settings.max_daily_loss_usd:
        return RiskResult(False, 0.0, 0.0, 'max_daily_loss_hit')
    if heartbeat_age_seconds is not None and heartbeat_age_seconds > 10:
        return RiskResult(False, 0.0, 0.0, 'stale_market_data')
    if ind.spread_bps is None:
        return RiskResult(False, 0.0, 0.0, 'no_spread')
    if ind.realized_vol_5m is not None and ind.realized_vol_5m > 0.02:
        return RiskResult(False, 0.0, 0.0, 'volatility_too_high')

    spread_cap = 12 if asset == 'IOTX-USD' else 20
    if ind.spread_bps > spread_cap:
        return RiskResult(False, 0.0, 0.0, 'spread_too_wide')

    if settings.ema_filter_enabled and ind.ema20 is not None and ind.ema50 is not None:
        if not (ind.price > ind.ema20 and ind.ema20 >= ind.ema50):
            return RiskResult(False, 0.0, 0.0, 'ema_filter_block')
    if settings.relative_strength_filter_enabled and ind.relative_strength_fast is not None and ind.relative_strength_fast < 0:
        return RiskResult(False, 0.0, 0.0, 'relative_strength_block')

    if decision.stop_price is None or decision.stop_price >= ind.price:
        return RiskResult(False, 0.0, 0.0, 'invalid_stop')

    max_size_by_notional = settings.max_trade_amount_usd / ind.price
    risk_per_unit = ind.price - decision.stop_price
    max_size_by_loss = settings.max_loss_per_trade_usd / risk_per_unit
    raw_qty = min(max_size_by_notional, max_size_by_loss)
    qty = raw_qty if settings.trade_amount_mode == 'manual' else raw_qty * SIZE_FACTOR[settings.aggressiveness]
    if ind.spread_bps and ind.spread_bps > (8 if asset == 'IOTX-USD' else 12):
        qty *= 0.75
    if ind.realized_vol_5m and ind.realized_vol_5m > 0.01:
        qty *= 0.75
    qty = floor(qty * 10000) / 10000
    if qty <= 0:
        return RiskResult(False, 0.0, 0.0, 'quantity_zero')
    notional = qty * ind.price
    return RiskResult(True, qty, notional, None)
