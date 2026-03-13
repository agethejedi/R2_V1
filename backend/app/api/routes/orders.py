from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.bot import BotSetting
from app.models.order import Order, Position
from app.schemas.order import OrderRead, PositionRead
from app.services.runtime_singleton import orchestrator

router = APIRouter(prefix='/orders', tags=['orders'])


@router.get('', response_model=list[OrderRead])
def list_orders(_: CurrentUser, db: Session = Depends(get_db), asset: str | None = None, mode: str | None = None):
    query = db.query(Order).order_by(Order.created_at.desc())
    if asset:
        query = query.filter(Order.asset == asset)
    if mode:
        query = query.filter(Order.mode == mode)
    return query.limit(200).all()


@router.get('/positions', response_model=list[PositionRead])
def list_positions(_: CurrentUser, db: Session = Depends(get_db)):
    return db.query(Position).order_by(Position.asset.asc()).all()


@router.post('/close-position')
def close_position(_: CurrentUser, asset: str, mode: str, db: Session = Depends(get_db)):
    position = db.query(Position).filter_by(asset=asset, mode=mode).first()
    if not position or position.quantity <= 0:
        raise HTTPException(status_code=404, detail='No open position found')
    settings = db.query(BotSetting).first()
    if not settings:
        raise HTTPException(status_code=404, detail='Bot settings not found')
    snapshot = orchestrator.ws.get_snapshot(asset)
    if snapshot.price is None:
        raise HTTPException(status_code=400, detail='No market price available')
    if mode == 'paper':
        order = orchestrator.paper_executor.execute_sell(db, settings, position, snapshot.price, 'manual_close')
    else:
        order = orchestrator.live_executor.execute_sell(db, settings, position, snapshot.price, 'manual_close')
    return {'ok': True, 'order_id': order.internal_order_id if order else None}
