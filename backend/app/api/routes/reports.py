from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.report import PnlSummary
from app.services.reporting import build_exit_reason_breakdown, build_mode_comparison, build_pnl_summary

router = APIRouter(prefix='/reports', tags=['reports'])


@router.get('/pnl', response_model=PnlSummary)
def pnl(_: CurrentUser, db: Session = Depends(get_db), asset: str | None = None, mode: str | None = None):
    return build_pnl_summary(db, asset=asset, mode=mode)


@router.get('/comparison')
def comparison(_: CurrentUser, db: Session = Depends(get_db), asset: str | None = None):
    return build_mode_comparison(db, asset=asset)


@router.get('/exit-reasons')
def exit_reasons(_: CurrentUser, db: Session = Depends(get_db), asset: str | None = None, mode: str | None = None):
    return build_exit_reason_breakdown(db, asset=asset, mode=mode)
