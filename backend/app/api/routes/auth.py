from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import authenticate_user, create_access_token
from app.db.session import get_db
from app.schemas.auth import LoginRequest, Token

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/login', response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid username or password')
    settings = get_settings()
    token = create_access_token(user.username, timedelta(minutes=settings.jwt_access_token_expire_minutes))
    return Token(access_token=token)
