from __future__ import annotations

import json
import logging
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable

from coinbase.websocket import WSClient, WSUserClient, WebsocketResponse

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class MarketSnapshot:
    product_id: str
    price: float | None = None
    bid: float | None = None
    ask: float | None = None
    spread_bps: float | None = None
    heartbeat_at: float = 0.0
    order_book_bids: list[tuple[float, float]] = field(default_factory=list)
    order_book_asks: list[tuple[float, float]] = field(default_factory=list)
    recent_trades: list[dict[str, Any]] = field(default_factory=list)
    recent_prices: list[tuple[float, float]] = field(default_factory=list)


class CoinbaseWebsocketManager:
    def __init__(self) -> None:
        settings = get_settings()
        self.settings = settings
        self.market_snapshots: dict[str, MarketSnapshot] = {}
        self._market_client: WSClient | None = None
        self._user_client: WSUserClient | None = None
        self._lock = threading.Lock()
        self._callbacks: list[Callable[[str, dict[str, Any]], None]] = []
        self._user_callbacks: list[Callable[[dict[str, Any]], None]] = []
        self._subscriptions: set[str] = set()
        self._user_connected = False
        self._market_connected = False

    def register_callback(self, callback: Callable[[str, dict[str, Any]], None]) -> None:
        self._callbacks.append(callback)

    def register_user_callback(self, callback: Callable[[dict[str, Any]], None]) -> None:
        self._user_callbacks.append(callback)

    def start(self, product_ids: list[str]) -> None:
        self._subscriptions = set(product_ids)
        self._open_market_client(product_ids)
        if self.settings.coinbase_api_key and self.settings.coinbase_api_secret:
            self._open_user_client()

    def stop(self) -> None:
        if self._market_client:
            self._market_client.close()
        if self._user_client:
            self._user_client.close()
        self._market_connected = False
        self._user_connected = False

    def _open_market_client(self, product_ids: list[str]) -> None:
        def on_message(raw: str) -> None:
            self._handle_market_message(raw)

        def on_open() -> None:
            logger.info('Market WS opened')
            self._market_connected = True

        def on_close() -> None:
            logger.warning('Market WS closed')
            self._market_connected = False

        kwargs: dict[str, Any] = {
            'on_message': on_message,
            'on_open': on_open,
            'on_close': on_close,
            'retry': True,
            'verbose': False,
        }
        if self.settings.coinbase_api_key and self.settings.coinbase_api_secret:
            kwargs['api_key'] = self.settings.coinbase_api_key
            kwargs['api_secret'] = self.settings.coinbase_api_secret

        self._market_client = WSClient(**kwargs)
        self._market_client.open()
        self._market_client.subscribe(product_ids=product_ids, channels=['ticker', 'level2', 'market_trades', 'heartbeats'])

    def _open_user_client(self) -> None:
        def on_message(raw: str) -> None:
            msg = json.loads(raw)
            for cb in self._user_callbacks:
                cb(msg)

        def on_open() -> None:
            logger.info('User WS opened')
            self._user_connected = True

        def on_close() -> None:
            logger.warning('User WS closed')
            self._user_connected = False

        self._user_client = WSUserClient(
            api_key=self.settings.coinbase_api_key,
            api_secret=self.settings.coinbase_api_secret,
            on_message=on_message,
            on_open=on_open,
            on_close=on_close,
            retry=True,
            verbose=False,
        )
        self._user_client.open()
        self._user_client.subscribe(channels=['user', 'heartbeats'])

    def _ensure_snapshot(self, product_id: str) -> MarketSnapshot:
        with self._lock:
            if product_id not in self.market_snapshots:
                self.market_snapshots[product_id] = MarketSnapshot(product_id=product_id)
            return self.market_snapshots[product_id]

    def _handle_market_message(self, raw: str) -> None:
        ws_obj = WebsocketResponse(json.loads(raw))
        channel = ws_obj.channel or 'unknown'

        if channel == 'heartbeats':
            for event in ws_obj.events:
                for hb in getattr(event, 'heartbeats', []) or []:
                    product_id = getattr(hb, 'product_id', None) or next(iter(self._subscriptions), self.settings.default_asset)
                    snap = self._ensure_snapshot(product_id)
                    snap.heartbeat_at = time.time()
        elif channel == 'ticker':
            for event in ws_obj.events:
                for ticker in getattr(event, 'tickers', []) or []:
                    snap = self._ensure_snapshot(ticker.product_id)
                    snap.price = float(ticker.price)
                    snap.bid = float(ticker.best_bid) if getattr(ticker, 'best_bid', None) else snap.bid
                    snap.ask = float(ticker.best_ask) if getattr(ticker, 'best_ask', None) else snap.ask
                    if snap.bid and snap.ask and snap.bid > 0:
                        snap.spread_bps = ((snap.ask - snap.bid) / snap.bid) * 10000
                    snap.recent_prices.append((time.time(), snap.price))
                    snap.recent_prices = snap.recent_prices[-500:]
        elif channel == 'level2':
            for event in ws_obj.events:
                product_id = getattr(event, 'product_id', None) or self.settings.default_asset
                snap = self._ensure_snapshot(product_id)
                updates = getattr(event, 'updates', []) or []
                bids: list[tuple[float, float]] = []
                asks: list[tuple[float, float]] = []
                for u in updates:
                    side = getattr(u, 'side', '')
                    price = float(getattr(u, 'price_level', 0) or 0)
                    qty = float(getattr(u, 'new_quantity', 0) or 0)
                    if side.upper() == 'BID':
                        bids.append((price, qty))
                    elif side.upper() == 'ASK':
                        asks.append((price, qty))
                if bids:
                    snap.order_book_bids = sorted(bids, key=lambda x: x[0], reverse=True)[:10]
                if asks:
                    snap.order_book_asks = sorted(asks, key=lambda x: x[0])[:10]
        elif channel == 'market_trades':
            for event in ws_obj.events:
                trades = getattr(event, 'trades', []) or []
                for trade in trades:
                    snap = self._ensure_snapshot(trade.product_id)
                    snap.recent_trades.append(
                        {
                            'time': time.time(),
                            'price': float(trade.price),
                            'size': float(trade.size),
                            'side': getattr(trade, 'side', 'UNKNOWN'),
                        }
                    )
                    snap.recent_trades = snap.recent_trades[-200:]
        payload = json.loads(raw)
        for cb in self._callbacks:
            cb(channel, payload)

    def get_snapshot(self, product_id: str) -> MarketSnapshot:
        return self._ensure_snapshot(product_id)

    def health(self) -> dict[str, Any]:
        now = time.time()
        ages = [now - snap.heartbeat_at for snap in self.market_snapshots.values() if snap.heartbeat_at]
        heartbeat_age = min(ages) if ages else 999.0
        return {
            'market_connected': self._market_connected,
            'user_connected': self._user_connected,
            'heartbeat_age_seconds': heartbeat_age,
        }
