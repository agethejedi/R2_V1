from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.bot import BotSetting, BotState
from app.models.order import Position
from app.services.coinbase_client import CoinbaseClient
from app.services.coinbase_ws import CoinbaseWebsocketManager
from app.services.commentary import generate_commentary
from app.services.execution import LiveExecutor, PaperExecutor
from app.services.indicators import build_indicators
from app.services.persistence import log_signal
from app.services.position_manager import decide_exit, execute_exit, update_position_mark_to_market
from app.services.regime import classify_regime
from app.services.risk import evaluate_risk
from app.services.strategy import build_trade_plan

logger = logging.getLogger(__name__)


@dataclass
class BotRuntime:
    task: asyncio.Task | None = None
    running: bool = False
    last_entry_at: float = 0.0


class BotOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.coinbase = CoinbaseClient()
        self.ws = CoinbaseWebsocketManager()
        self.runtime = BotRuntime()
        self.paper_executor = PaperExecutor()
        self.live_executor = LiveExecutor(self.coinbase)
        self.ws.start(self.settings.allowed_assets_list)

    def get_db(self) -> Session:
        return SessionLocal()

    def _benchmark_for(self, asset: str) -> str | None:
        if asset == 'ETH-USD':
            return 'BTC-USD'
        if asset == 'IOTX-USD':
            return 'ETH-USD'
        return None

    def _today_loss(self, db: Session, asset: str, mode: str) -> float:
        positions = db.query(Position).filter_by(asset=asset, mode=mode).all()
        realized = sum(min(0.0, p.realized_pnl) for p in positions)
        return abs(realized)

    async def loop(self) -> None:
        self.runtime.running = True
        while self.runtime.running:
            db = self.get_db()
            try:
                bot_settings = db.query(BotSetting).first()
                bot_state = db.query(BotState).first()
                if not bot_settings or not bot_state:
                    await asyncio.sleep(1)
                    continue

                health = self.ws.health()
                bot_state.websocket_connected = health['market_connected']
                bot_state.user_websocket_connected = health['user_connected']
                bot_state.rest_connected = self.coinbase.authenticated
                bot_state.heartbeat_age_seconds = health['heartbeat_age_seconds']
                bot_state.state = 'paused' if bot_settings.trading_mode == 'paused' else 'standby'
                db.commit()

                asset = bot_settings.active_asset
                mode = bot_settings.trading_mode
                snapshot = self.ws.get_snapshot(asset)
                benchmark_asset = self._benchmark_for(asset)
                benchmark_snapshot = self.ws.get_snapshot(benchmark_asset) if benchmark_asset else None
                indicators = build_indicators(snapshot, benchmark_snapshot)
                if indicators is None:
                    bot_state.last_message = 'awaiting market data'
                    db.commit()
                    await asyncio.sleep(1)
                    continue

                regime = classify_regime(indicators)
                position = db.query(Position).filter_by(asset=asset, mode='paper' if mode == 'paper' else 'live').first()
                if position and position.quantity > 0:
                    update_position_mark_to_market(db, position, indicators.price)
                    exit_action = decide_exit(position, indicators.price, kill_switch_enabled=bot_settings.kill_switch_enabled)
                    commentary = generate_commentary(bot_settings, indicators, regime, None, position)
                    if exit_action.action == 'exit':
                        execute_exit(db, bot_settings, position, indicators.price, self.paper_executor, self.live_executor, exit_action.reason or 'rule_exit')
                        bot_state.state = 'cooldown'
                        bot_state.last_signal = 'exit_long'
                        bot_state.last_message = commentary['position_summary']
                        db.commit()
                        await asyncio.sleep(2)
                        continue
                    bot_state.state = 'in_position'
                    bot_state.last_message = commentary['position_summary']
                    db.commit()
                    await asyncio.sleep(2)
                    continue

                decision = build_trade_plan(asset, indicators, bot_settings.aggressiveness, bot_settings.desired_profit_per_trade_usd if bot_settings.profit_target_mode == 'manual' else None)
                log_signal(db, asset, bot_settings.aggressiveness, decision)
                risk = evaluate_risk(
                    bot_settings,
                    asset,
                    indicators,
                    decision,
                    daily_realized_loss_usd=self._today_loss(db, asset, 'paper' if mode == 'paper' else 'live'),
                    position_open=False,
                    heartbeat_age_seconds=health['heartbeat_age_seconds'],
                )
                commentary = generate_commentary(bot_settings, indicators, regime, decision, position, risk_reason=risk.reason)
                bot_state.last_signal = decision.recommendation
                bot_state.last_message = commentary['decision_summary']
                db.commit()

                now = time.time()
                if risk.allowed and (now - self.runtime.last_entry_at) >= bot_settings.min_entry_interval_seconds:
                    bot_state.state = 'in_position'
                    db.commit()
                    if bot_settings.trading_mode == 'paper':
                        self.paper_executor.execute_buy(
                            db, bot_settings, asset, risk.quantity, indicators.price, decision.setup_type,
                            stop_price=decision.stop_price, target_price=decision.target_price,
                        )
                    elif bot_settings.trading_mode == 'live':
                        self.live_executor.execute_buy(
                            db, bot_settings, asset, risk.quantity, indicators.price, decision.setup_type,
                            stop_price=decision.stop_price, target_price=decision.target_price,
                        )
                    self.runtime.last_entry_at = now
                else:
                    bot_state.state = 'cooldown' if (now - self.runtime.last_entry_at) < bot_settings.min_entry_interval_seconds else 'standby'
                    if risk.reason:
                        bot_state.last_message = commentary['decision_summary']
                    db.commit()
            except Exception as exc:  # pragma: no cover
                logger.exception('bot loop error: %s', exc)
            finally:
                db.close()
            await asyncio.sleep(2)

    def start(self) -> None:
        if self.runtime.task and not self.runtime.task.done():
            return
        self.runtime.task = asyncio.create_task(self.loop())

    def stop(self) -> None:
        self.runtime.running = False
        if self.runtime.task and not self.runtime.task.done():
            self.runtime.task.cancel()
