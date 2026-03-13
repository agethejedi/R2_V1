from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.order import Fill, Order, Position
from app.models.signal import SignalLog
from app.services.strategy import StrategyDecision


def log_signal(db: Session, asset: str, aggressiveness: str, decision: StrategyDecision) -> SignalLog:
    row = SignalLog(
        asset=asset,
        aggressiveness=aggressiveness,
        setup_type=decision.setup_type,
        recommendation=decision.recommendation,
        composite_score=decision.composite_score,
        vwap_score=decision.score_breakdown['vwap'],
        orderbook_score=decision.score_breakdown['orderbook'],
        tradeflow_score=decision.score_breakdown['tradeflow'],
        momentum_score=decision.score_breakdown['momentum'],
        spread_score=decision.score_breakdown['spread'],
        volume_score=decision.score_breakdown['volume'],
        ema_score=decision.score_breakdown['ema'],
        rs_score=decision.score_breakdown['rs'],
        details=decision.rationale,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def ensure_position(db: Session, asset: str, mode: str) -> Position:
    position = db.query(Position).filter_by(asset=asset, mode=mode).first()
    if not position:
        position = Position(asset=asset, mode=mode, quantity=0, average_entry_price=0, status='flat')
        db.add(position)
        db.commit()
        db.refresh(position)
    return position


def create_order(db: Session, *, asset: str, mode: str, side: str, order_type: str, requested_notional_usd: float, requested_quantity: float, strategy_tag: str | None, exit_reason: str | None = None) -> Order:
    order = Order(
        internal_order_id=str(uuid4()),
        asset=asset,
        mode=mode,
        side=side,
        order_type=order_type,
        requested_notional_usd=requested_notional_usd,
        requested_quantity=requested_quantity,
        strategy_tag=strategy_tag,
        exit_reason=exit_reason,
        status='pending',
        opened_at=datetime.now(timezone.utc),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def mark_order_filled(db: Session, order: Order, *, fill_price: float, fill_qty: float, fee_usd: float, slippage_usd: float = 0.0, exchange_order_id: str | None = None, liquidity_indicator: str | None = None) -> Order:
    order.exchange_order_id = exchange_order_id
    order.filled_quantity = fill_qty
    order.average_fill_price = fill_price
    order.fee_usd = fee_usd
    order.slippage_usd = slippage_usd
    order.status = 'filled'
    order.closed_at = datetime.now(timezone.utc)
    db.add(
        Fill(
            order_internal_id=order.internal_order_id,
            order_exchange_id=exchange_order_id,
            asset=order.asset,
            side=order.side,
            fill_quantity=fill_qty,
            fill_price=fill_price,
            fee_usd=fee_usd,
            liquidity_indicator=liquidity_indicator,
            trade_time=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.refresh(order)
    return order


def set_position_trade_plan(db: Session, position: Position, *, stop_loss_price: float | None, target_price: float | None, entry_order_internal_id: str | None = None) -> Position:
    position.stop_loss_price = stop_loss_price
    position.target_price = target_price
    position.entry_order_internal_id = entry_order_internal_id
    if position.peak_price is None:
        position.peak_price = position.average_entry_price or None
    db.commit()
    db.refresh(position)
    return position


def mark_position_market(db: Session, position: Position, *, last_price: float) -> Position:
    position.last_price = last_price
    if position.quantity > 0 and position.average_entry_price > 0:
        position.unrealized_pnl = (last_price - position.average_entry_price) * position.quantity
        if position.peak_price is None:
            position.peak_price = last_price
        else:
            position.peak_price = max(position.peak_price, last_price)
    else:
        position.unrealized_pnl = 0.0
    db.commit()
    db.refresh(position)
    return position


def update_position_for_fill(db: Session, position: Position, order: Order) -> Position:
    if order.side.lower() == 'buy':
        total_cost = (position.quantity * position.average_entry_price) + (order.filled_quantity * (order.average_fill_price or 0))
        position.quantity += order.filled_quantity
        position.average_entry_price = total_cost / max(position.quantity, 1e-9)
        position.status = 'open' if position.quantity > 0 else 'flat'
        position.last_price = order.average_fill_price
        position.peak_price = order.average_fill_price
    else:
        sell_qty = min(position.quantity, order.filled_quantity)
        realized = ((order.average_fill_price or 0) - position.average_entry_price) * sell_qty - order.fee_usd - order.slippage_usd
        position.quantity -= sell_qty
        position.realized_pnl += realized
        position.last_price = order.average_fill_price
        position.status = 'flat' if position.quantity <= 0 else 'open'
        if position.quantity <= 0:
            position.quantity = 0
            position.average_entry_price = 0
            position.unrealized_pnl = 0
            position.stop_loss_price = None
            position.target_price = None
            position.peak_price = None
            position.exit_order_internal_id = order.internal_order_id
    db.commit()
    db.refresh(position)
    return position
