from datetime import datetime
from pydantic import BaseModel


class OrderRead(BaseModel):
    id: int
    internal_order_id: str
    exchange_order_id: str | None
    asset: str
    mode: str
    side: str
    order_type: str
    requested_notional_usd: float
    requested_quantity: float
    filled_quantity: float
    average_fill_price: float | None
    fee_usd: float
    slippage_usd: float
    status: str
    strategy_tag: str | None
    exit_reason: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class PositionRead(BaseModel):
    id: int
    asset: str
    mode: str
    quantity: float
    average_entry_price: float
    realized_pnl: float
    unrealized_pnl: float
    stop_loss_price: float | None = None
    target_price: float | None = None
    peak_price: float | None = None
    last_price: float | None = None
    status: str

    class Config:
        from_attributes = True
