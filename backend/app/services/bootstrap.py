from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.bot import BotSetting, BotState
from app.models.user import DashboardUser


def bootstrap_defaults(db: Session) -> None:
    settings = get_settings()
    user = db.query(DashboardUser).filter_by(username=settings.admin_username).first()
    if not user:
        db.add(DashboardUser(username=settings.admin_username, password_hash=get_password_hash(settings.admin_password)))

    bot_settings = db.query(BotSetting).first()
    if not bot_settings:
        db.add(
            BotSetting(
                active_asset=settings.default_asset,
                trading_mode='paper',
                live_switch_enabled=False,
                kill_switch_enabled=False,
                aggressiveness='balanced',
                trade_amount_mode='manual',
                profit_target_mode='manual',
                max_trade_amount_usd=100,
                max_loss_per_trade_usd=10,
                desired_profit_per_trade_usd=15,
                max_daily_loss_usd=30,
                min_entry_interval_seconds=60,
                ema_filter_enabled=True,
                relative_strength_filter_enabled=True,
            )
        )

    bot_state = db.query(BotState).first()
    if not bot_state:
        db.add(BotState())

    db.commit()
