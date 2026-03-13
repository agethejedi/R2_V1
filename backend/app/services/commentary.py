from __future__ import annotations

from app.models.bot import BotSetting
from app.models.order import Position
from app.services.indicators import IndicatorBundle
from app.services.regime import RegimeAssessment
from app.services.strategy import StrategyDecision


def _fmt_pct(value: float | None, digits: int = 2) -> str:
    if value is None:
        return 'n/a'
    return f"{value * 100:.{digits}f}%"


def generate_commentary(settings: BotSetting, ind: IndicatorBundle, regime: RegimeAssessment, decision: StrategyDecision | None, position: Position | None, risk_reason: str | None = None) -> dict[str, str]:
    market = (
        f"{settings.active_asset} is in {regime.regime} with {regime.confidence} confidence. "
        f"Price is {('above' if ind.vwap and ind.price > ind.vwap else 'below')} VWAP, "
        f"EMA20/EMA50 alignment is "
        f"{('bullish' if ind.ema20 and ind.ema50 and ind.price > ind.ema20 > ind.ema50 else 'mixed')}, "
        f"and fast relative strength is {_fmt_pct(ind.relative_strength_fast)}."
    )

    posture = (
        f"Bot posture is {settings.aggressiveness}. Current regime effect: {regime.posture}. "
        f"EMA filter is {'on' if settings.ema_filter_enabled else 'off'} and relative strength filter is {'on' if settings.relative_strength_filter_enabled else 'off'}."
    )

    if decision is None:
        decision_text = 'No decision computed yet.'
    else:
        if decision.recommendation == 'enter_long':
            decision_text = (
                f"Entry eligible via {decision.setup_type}. Composite score is {decision.composite_score:.2f}. "
                f"Target is {decision.target_price:.6f} and stop is {decision.stop_price:.6f}."
            )
        else:
            decision_text = (
                f"No trade taken. Composite score is {decision.composite_score:.2f} with setup {decision.setup_type}."
            )
        if risk_reason:
            decision_text += f" Primary block: {risk_reason}."

    if position and position.quantity > 0:
        position_text = (
            f"Open {position.mode} long in {position.asset}. Qty {position.quantity:.4f}, avg entry {position.average_entry_price:.6f}, "
            f"unrealized P&L {position.unrealized_pnl:.2f}. Stop {position.stop_loss_price or 0:.6f}, target {position.target_price or 0:.6f}."
        )
    else:
        position_text = 'No open position. Bot is waiting for a higher-quality setup.'

    risk = (
        f"Hard caps remain max trade ${settings.max_trade_amount_usd:.2f}, max loss ${settings.max_loss_per_trade_usd:.2f}, "
        f"max daily loss ${settings.max_daily_loss_usd:.2f}. Live switch is {'on' if settings.live_switch_enabled else 'off'}; "
        f"kill switch is {'on' if settings.kill_switch_enabled else 'off'}."
    )

    return {
        'market_summary': market,
        'bot_posture': posture,
        'decision_summary': decision_text,
        'position_summary': position_text,
        'risk_summary': risk,
    }
