from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.signal import SignalLog

router = APIRouter(prefix='/logs', tags=['logs'])


@router.get('/signals')
def signals(_: CurrentUser, db: Session = Depends(get_db), limit: int = 100):
    rows = db.query(SignalLog).order_by(SignalLog.created_at.desc()).limit(limit).all()
    return [
        {
            'id': row.id,
            'asset': row.asset,
            'aggressiveness': row.aggressiveness,
            'setup_type': row.setup_type,
            'recommendation': row.recommendation,
            'composite_score': row.composite_score,
            'details': row.details,
            'created_at': row.created_at,
        }
        for row in rows
    ]
