from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db


DBSession = Depends(get_db)
CurrentUser = Depends(get_current_user)
