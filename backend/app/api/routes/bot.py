from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.bot import BotSetting, BotState
from app.models.order import Position
from app.schemas.bot import BotSettingsRead, BotSettingsUpdate, BotStatusRead
from app.services.commentary import generate_commentary
from app.services.indicators import build_indicators
from app.services.regime import classify_regime
from app.services.runtime_singleton import orchestrator
from app.services.strategy import build_trade_plan

router = APIRouter(prefix='/bot', tags=['bot'])


@router.get('/settings', response_model=BotSettingsRead)
def read_settings(_: CurrentUser, db: Session = Depends(get_db)):
    row = db.query(BotSetting).first()
    if not row:
        raise HTTPException(status_code=404, detail='Bot settings not found')
    return row


@router.put('/settings', response_model=BotSettingsRead)
def update_settings(payload: BotSettingsUpdate, _: CurrentUser, db: Session = Depends(get_db)):
    row = db.query(BotSetting).first()
    if not row:
        raise HTTPException(status_code=404, detail='Bot settings not found')
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.get('/status', response_model=BotStatusRead)
def status(_: CurrentUser, db: Session = Depends(get_db)):
    state = db.query(BotState).first()
    settings = db.query(BotSetting).first()
    if not state or not settings:
        raise HTTPException(status_code=404, detail='Bot not initialized')

    benchmark = orchestrator._benchmark_for(settings.active_asset)
    snapshot = orchestrator.ws.get_snapshot(settings.active_asset)
    benchmark_snapshot = orchestrator.ws.get_snapshot(benchmark) if benchmark else None
    indicators = build_indicators(snapshot, benchmark_snapshot) if snapshot else None
    position = db.query(Position).filter_by(asset=settings.active_asset, mode='paper' if settings.trading_mode == 'paper' else 'live').first()

    regime = None
    commentary = {}
    decision = None
    if indicators is not None:
        regime = classify_regime(indicators)
        decision = build_trade_plan(settings.active_asset, indicators, settings.aggressiveness, settings.desired_profit_per_trade_usd if settings.profit_target_mode == 'manual' else None)
        commentary = generate_commentary(settings, indicators, regime, decision, position)

    return BotStatusRead(
        state=state.state,
        websocket_connected=state.websocket_connected,
        user_websocket_connected=state.user_websocket_connected,
        rest_connected=state.rest_connected,
        heartbeat_age_seconds=state.heartbeat_age_seconds,
        last_signal=state.last_signal,
        last_message=state.last_message,
        active_asset=settings.active_asset,
        trading_mode=settings.trading_mode,
        live_switch_enabled=settings.live_switch_enabled,
        kill_switch_enabled=settings.kill_switch_enabled,
        regime=regime.regime if regime else None,
        regime_confidence=regime.confidence if regime else None,
        regime_posture=regime.posture if regime else None,
        market_summary=commentary.get('market_summary'),
        bot_posture=commentary.get('bot_posture'),
        decision_summary=commentary.get('decision_summary'),
        position_summary=commentary.get('position_summary'),
        risk_summary=commentary.get('risk_summary'),
        signal_score=decision.composite_score if decision else None,
        entry_eligible=(decision.recommendation == 'enter_long') if decision else None,
        price=indicators.price if indicators else None,
        vwap=indicators.vwap if indicators else None,
        ema20=indicators.ema20 if indicators else None,
        ema50=indicators.ema50 if indicators else None,
        spread_bps=indicators.spread_bps if indicators else None,
        relative_strength_fast=indicators.relative_strength_fast if indicators else None,
        relative_strength_slow=indicators.relative_strength_slow if indicators else None,
        open_position_qty=position.quantity if position else None,
        unrealized_pnl=position.unrealized_pnl if position else None,
    )


@router.post('/start')
def start(_: CurrentUser):
    orchestrator.start()
    return {'ok': True}


@router.post('/stop')
def stop(_: CurrentUser):
    orchestrator.stop()
    return {'ok': True}
