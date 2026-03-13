from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.bot import BotSetting
from app.models.order import Position
from app.services.coinbase_client import CoinbaseClient
from app.services.persistence import create_order, ensure_position, mark_order_filled, set_position_trade_plan, update_position_for_fill

logger = logging.getLogger(__name__)


class PaperExecutor:
    def execute_buy(self, db: Session, settings: BotSetting, asset: str, qty: float, price: float, strategy_tag: str, stop_price: float | None = None, target_price: float | None = None):
        order = create_order(
            db,
            asset=asset,
            mode='paper',
            side='buy',
            order_type='market',
            requested_notional_usd=qty * price,
            requested_quantity=qty,
            strategy_tag=strategy_tag,
        )
        slippage = (qty * price) * 0.0005
        fee = (qty * price) * 0.006
        mark_order_filled(db, order, fill_price=price, fill_qty=qty, fee_usd=fee, slippage_usd=slippage)
        position = ensure_position(db, asset, 'paper')
        update_position_for_fill(db, position, order)
        set_position_trade_plan(db, position, stop_loss_price=stop_price, target_price=target_price, entry_order_internal_id=order.internal_order_id)
        return order

    def execute_sell(self, db: Session, settings: BotSetting, position: Position, price: float, exit_reason: str):
        qty = position.quantity
        if qty <= 0:
            return None
        order = create_order(
            db,
            asset=position.asset,
            mode='paper',
            side='sell',
            order_type='market',
            requested_notional_usd=qty * price,
            requested_quantity=qty,
            strategy_tag='exit',
            exit_reason=exit_reason,
        )
        slippage = (qty * price) * 0.0005
        fee = (qty * price) * 0.006
        mark_order_filled(db, order, fill_price=price, fill_qty=qty, fee_usd=fee, slippage_usd=slippage)
        update_position_for_fill(db, position, order)
        return order


class LiveExecutor:
    def __init__(self, client: CoinbaseClient) -> None:
        self.client = client

    def _extract_order_id(self, response):
        if isinstance(response, dict):
            return response.get('success_response', {}).get('order_id')
        return getattr(getattr(response, 'success_response', None), 'order_id', None)

    def execute_buy(self, db: Session, settings: BotSetting, asset: str, qty: float, price: float, strategy_tag: str, stop_price: float | None = None, target_price: float | None = None):
        order = create_order(
            db,
            asset=asset,
            mode='live',
            side='buy',
            order_type='market',
            requested_notional_usd=qty * price,
            requested_quantity=qty,
            strategy_tag=strategy_tag,
        )
        if not settings.live_switch_enabled:
            order.status = 'rejected'
            db.commit()
            return order

        response = self.client.create_market_buy_order(asset, qty * price, order.internal_order_id)
        exchange_order_id = self._extract_order_id(response)
        fee = (qty * price) * 0.006
        mark_order_filled(db, order, fill_price=price, fill_qty=qty, fee_usd=fee, exchange_order_id=exchange_order_id)
        position = ensure_position(db, asset, 'live')
        update_position_for_fill(db, position, order)
        set_position_trade_plan(db, position, stop_loss_price=stop_price, target_price=target_price, entry_order_internal_id=order.internal_order_id)
        return order

    def execute_sell(self, db: Session, settings: BotSetting, position: Position, price: float, exit_reason: str):
        qty = position.quantity
        if qty <= 0:
            return None
        order = create_order(
            db,
            asset=position.asset,
            mode='live',
            side='sell',
            order_type='market',
            requested_notional_usd=qty * price,
            requested_quantity=qty,
            strategy_tag='exit',
            exit_reason=exit_reason,
        )
        if not settings.live_switch_enabled:
            order.status = 'rejected'
            db.commit()
            return order
        response = self.client.create_market_sell_order(position.asset, qty, order.internal_order_id)
        exchange_order_id = self._extract_order_id(response)
        fee = (qty * price) * 0.006
        mark_order_filled(db, order, fill_price=price, fill_qty=qty, fee_usd=fee, exchange_order_id=exchange_order_id)
        update_position_for_fill(db, position, order)
        return order
