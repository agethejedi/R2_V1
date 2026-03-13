from sqlalchemy.orm import Session

from app.models.order import Order, Position
from app.schemas.report import PnlSummary


def build_pnl_summary(db: Session, asset: str | None = None, mode: str | None = None) -> PnlSummary:
    query = db.query(Order)
    if asset:
        query = query.filter(Order.asset == asset)
    if mode:
        query = query.filter(Order.mode == mode)
    orders = query.all()
    filled = [o for o in orders if o.status == 'filled']
    notionals = [o.requested_notional_usd for o in filled]
    fees = sum(o.fee_usd for o in filled)

    position_query = db.query(Position)
    if asset:
        position_query = position_query.filter(Position.asset == asset)
    if mode:
        position_query = position_query.filter(Position.mode == mode)
    positions = position_query.all()
    realized = sum(p.realized_pnl for p in positions)
    unrealized = sum(p.unrealized_pnl for p in positions)

    wins = [p.realized_pnl for p in positions if p.realized_pnl > 0]
    losses = [p.realized_pnl for p in positions if p.realized_pnl < 0]
    order_count = len(filled)
    win_rate = (len(wins) / max(1, len([p for p in positions if p.realized_pnl != 0]))) * 100.0

    return PnlSummary(
        realized_pnl=round(realized, 2),
        unrealized_pnl=round(unrealized, 2),
        net_pnl_after_fees=round(realized + unrealized - fees, 2),
        win_rate=round(win_rate, 2),
        average_trade_size=round(sum(notionals) / max(1, len(notionals)), 2),
        largest_win=round(max(wins) if wins else 0.0, 2),
        largest_loss=round(min(losses) if losses else 0.0, 2),
        order_count=order_count,
    )


def build_mode_comparison(db: Session, asset: str | None = None):
    return {
        'paper': build_pnl_summary(db, asset=asset, mode='paper').model_dump(),
        'live': build_pnl_summary(db, asset=asset, mode='live').model_dump(),
    }


def build_exit_reason_breakdown(db: Session, asset: str | None = None, mode: str | None = None):
    query = db.query(Order).filter(Order.side == 'sell')
    if asset:
        query = query.filter(Order.asset == asset)
    if mode:
        query = query.filter(Order.mode == mode)
    rows = query.all()
    counts = {}
    for row in rows:
        reason = row.exit_reason or 'unspecified'
        counts[reason] = counts.get(reason, 0) + 1
    return counts
