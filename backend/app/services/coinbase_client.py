from __future__ import annotations

import logging
from typing import Any

from coinbase.rest import RESTClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class CoinbaseClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.settings = settings
        self.authenticated = bool(settings.coinbase_api_key and settings.coinbase_api_secret)
        kwargs: dict[str, Any] = {'timeout': settings.coinbase_timeout_seconds}
        if self.authenticated:
            kwargs['api_key'] = settings.coinbase_api_key
            kwargs['api_secret'] = settings.coinbase_api_secret
        self.client = RESTClient(**kwargs)

    def get_public_product(self, product_id: str):
        try:
            return self.client.get_public_product(product_id=product_id)
        except Exception:  # pragma: no cover
            return self.client.get_product(product_id=product_id)

    def get_candles(self, product_id: str, start: int, end: int, granularity: str = 'ONE_MINUTE'):
        return self.client.get_candles(product_id=product_id, start=str(start), end=str(end), granularity=granularity)

    def get_market_trades(self, product_id: str, limit: int = 50):
        return self.client.get(f'/api/v3/brokerage/products/{product_id}/ticker', params={'limit': limit})

    def get_best_bid_ask(self, product_id: str):
        return self.client.get('/api/v3/brokerage/best_bid_ask', params={'product_ids': [product_id]})

    def list_orders(self, product_id: str | None = None):
        params = {'product_id': product_id} if product_id else None
        return self.client.get('/api/v3/brokerage/orders/historical/batch', params=params)

    def list_fills(self, product_id: str | None = None):
        params = {'product_ids': [product_id]} if product_id else None
        return self.client.get('/api/v3/brokerage/orders/historical/fills', params=params)

    def get_accounts(self):
        return self.client.get_accounts()

    def get_transaction_summary(self):
        return self.client.get('/api/v3/brokerage/transaction_summary')

    def create_market_buy_order(self, product_id: str, quote_size: float, client_order_id: str):
        payload = {
            'client_order_id': client_order_id,
            'product_id': product_id,
            'side': 'BUY',
            'order_configuration': {
                'market_market_ioc': {
                    'quote_size': f'{quote_size:.2f}',
                }
            },
        }
        return self.client.post('/api/v3/brokerage/orders', data=payload)

    def create_market_sell_order(self, product_id: str, base_size: float, client_order_id: str):
        payload = {
            'client_order_id': client_order_id,
            'product_id': product_id,
            'side': 'SELL',
            'order_configuration': {
                'market_market_ioc': {
                    'base_size': f'{base_size:.8f}',
                }
            },
        }
        return self.client.post('/api/v3/brokerage/orders', data=payload)

    def create_limit_order(self, product_id: str, side: str, base_size: float, limit_price: float, client_order_id: str):
        payload = {
            'client_order_id': client_order_id,
            'product_id': product_id,
            'side': side.upper(),
            'order_configuration': {
                'limit_limit_gtc': {
                    'base_size': f'{base_size:.8f}',
                    'limit_price': f'{limit_price:.8f}',
                    'post_only': False,
                }
            },
        }
        return self.client.post('/api/v3/brokerage/orders', data=payload)

    def cancel_orders(self, order_ids: list[str]):
        return self.client.post('/api/v3/brokerage/orders/batch_cancel', data={'order_ids': order_ids})
