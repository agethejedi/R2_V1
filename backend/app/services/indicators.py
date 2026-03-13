from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev

from app.services.coinbase_ws import MarketSnapshot


@dataclass
class IndicatorBundle:
    price: float
    ema20: float | None
    ema50: float | None
    ema20_slope: float | None
    ema50_slope: float | None
    vwap: float | None
    vwap_slope: float | None
    momentum_1m: float | None
    volume_recent: float
    realized_vol_5m: float | None
    orderbook_imbalance: float
    tradeflow_imbalance: float
    spread_bps: float | None
    relative_strength_fast: float | None
    relative_strength_slow: float | None


def compute_ema(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = mean(values[:period])
    for price in values[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def compute_vwap(trades: list[dict]) -> float | None:
    if not trades:
        return None
    pv = sum(t['price'] * t['size'] for t in trades)
    volume = sum(t['size'] for t in trades)
    if volume <= 0:
        return None
    return pv / volume


def compute_orderbook_imbalance(bids: list[tuple[float, float]], asks: list[tuple[float, float]]) -> float:
    bid_depth = sum(q for _, q in bids[:5])
    ask_depth = sum(q for _, q in asks[:5])
    denom = bid_depth + ask_depth
    if denom == 0:
        return 0.0
    return (bid_depth - ask_depth) / denom


def compute_tradeflow_imbalance(trades: list[dict]) -> float:
    if not trades:
        return 0.0
    buy = sum(t['size'] for t in trades if str(t['side']).upper() in {'BUY', 'BID'})
    sell = sum(t['size'] for t in trades if str(t['side']).upper() in {'SELL', 'ASK'})
    denom = buy + sell
    if denom == 0:
        return 0.0
    return (buy - sell) / denom


def compute_return(prices: list[tuple[float, float]], lookback_seconds: int) -> float | None:
    if len(prices) < 2:
        return None
    end_time, end_price = prices[-1]
    start_candidates = [p for p in prices if end_time - p[0] >= lookback_seconds]
    if not start_candidates:
        return None
    start_price = start_candidates[-1][1]
    if start_price == 0:
        return None
    return (end_price - start_price) / start_price


def compute_slope(values: list[float], lookback: int = 5) -> float | None:
    if len(values) < lookback:
        return None
    start = values[-lookback]
    end = values[-1]
    if start == 0:
        return None
    return (end - start) / start


def compute_realized_vol(prices: list[tuple[float, float]], lookback_seconds: int = 300) -> float | None:
    if len(prices) < 5:
        return None
    end_time = prices[-1][0]
    window = [p for p in prices if end_time - p[0] <= lookback_seconds]
    vals = [p for _, p in window]
    if len(vals) < 5:
        return None
    rets = []
    for i in range(1, len(vals)):
        prev = vals[i - 1]
        if prev <= 0:
            continue
        rets.append((vals[i] - prev) / prev)
    if len(rets) < 3:
        return None
    return pstdev(rets)


def build_indicators(snapshot: MarketSnapshot, benchmark_snapshot: MarketSnapshot | None = None) -> IndicatorBundle | None:
    if snapshot.price is None:
        return None
    prices = [p for _, p in snapshot.recent_prices]
    ema20 = compute_ema(prices, 20)
    ema50 = compute_ema(prices, 50)
    ema20_slope = compute_slope(prices[-20:] if len(prices) >= 20 else prices, lookback=min(5, len(prices))) if prices else None
    ema50_slope = compute_slope(prices[-50:] if len(prices) >= 50 else prices, lookback=min(8, len(prices))) if prices else None
    vwap = compute_vwap(snapshot.recent_trades)
    if vwap is not None and snapshot.recent_trades:
        chunks = snapshot.recent_trades[-20:]
        recent_vwaps = []
        for i in range(5, len(chunks) + 1, 5):
            sub = chunks[:i]
            vw = compute_vwap(sub)
            if vw is not None:
                recent_vwaps.append(vw)
        vwap_slope = compute_slope(recent_vwaps, lookback=min(3, len(recent_vwaps))) if recent_vwaps else None
    else:
        vwap_slope = None
    momentum_1m = compute_return(snapshot.recent_prices, 60)
    volume_recent = sum(t['size'] for t in snapshot.recent_trades[-50:])
    realized_vol_5m = compute_realized_vol(snapshot.recent_prices, 300)
    ob_imb = compute_orderbook_imbalance(snapshot.order_book_bids, snapshot.order_book_asks)
    tf_imb = compute_tradeflow_imbalance(snapshot.recent_trades[-50:])

    rs_fast = None
    rs_slow = None
    if benchmark_snapshot:
        asset_fast = compute_return(snapshot.recent_prices, 300)
        bench_fast = compute_return(benchmark_snapshot.recent_prices, 300)
        asset_slow = compute_return(snapshot.recent_prices, 900)
        bench_slow = compute_return(benchmark_snapshot.recent_prices, 900)
        if asset_fast is not None and bench_fast is not None:
            rs_fast = asset_fast - bench_fast
        if asset_slow is not None and bench_slow is not None:
            rs_slow = asset_slow - bench_slow

    return IndicatorBundle(
        price=snapshot.price,
        ema20=ema20,
        ema50=ema50,
        ema20_slope=ema20_slope,
        ema50_slope=ema50_slope,
        vwap=vwap,
        vwap_slope=vwap_slope,
        momentum_1m=momentum_1m,
        volume_recent=volume_recent,
        realized_vol_5m=realized_vol_5m,
        orderbook_imbalance=ob_imb,
        tradeflow_imbalance=tf_imb,
        spread_bps=snapshot.spread_bps,
        relative_strength_fast=rs_fast,
        relative_strength_slow=rs_slow,
    )
