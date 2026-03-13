from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.bot import BotSetting
from app.models.order import Position
from app.services.execution import LiveExecutor, PaperExecutor
from app.services.persistence import mark_position_market


@dataclass
class PositionAction:
    action: str
    reason: str | None = None


def update_position_mark_to_market(db: Session, position: Position, market_price: float) -> Position:
    return mark_position_market(db, position, last_price=market_price)


def decide_exit(position: Position, market_price: float, *, kill_switch_enabled: bool = False) -> PositionAction:
    if position.quantity <= 0:
        return PositionAction('hold')
    if kill_switch_enabled:
        return PositionAction('exit', 'kill_switch')
    if position.stop_loss_price is not None and market_price <= position.stop_loss_price:
        return PositionAction('exit', 'stop_loss')
    if position.target_price is not None and market_price >= position.target_price:
        return PositionAction('exit', 'take_profit')
    if position.peak_price and position.average_entry_price > 0:
        # simple trailing protection after decent progress
        profit_progress = market_price - position.average_entry_price
        target_progress = (position.target_price or market_price) - position.average_entry_price
        if target_progress > 0 and profit_progress >= (0.5 * target_progress):
            trailing_floor = position.peak_price - ((position.peak_price - position.average_entry_price) * 0.4)
            if market_price <= trailing_floor:
                return PositionAction('exit', 'trailing_stop')
    return PositionAction('hold')


def execute_exit(db: Session, settings: BotSetting, position: Position, market_price: float, paper_executor: PaperExecutor, live_executor: LiveExecutor, reason: str):
    if position.mode == 'paper':
        return paper_executor.execute_sell(db, settings, position, market_price, reason)
    return live_executor.execute_sell(db, settings, position, market_price, reason)
