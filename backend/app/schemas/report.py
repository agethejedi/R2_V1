from pydantic import BaseModel


class PnlSummary(BaseModel):
    realized_pnl: float
    unrealized_pnl: float
    net_pnl_after_fees: float
    win_rate: float
    average_trade_size: float
    largest_win: float
    largest_loss: float
    order_count: int
