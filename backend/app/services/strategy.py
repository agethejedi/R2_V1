from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.services.indicators import IndicatorBundle

Agg = Literal['conservative', 'balanced', 'aggressive']


@dataclass
class StrategyDecision:
    recommendation: str
    setup_type: str
    composite_score: float
    score_breakdown: dict[str, float]
    stop_price: float | None
    target_price: float | None
    rationale: dict


THRESHOLDS = {
    'conservative': {'score': 80, 'rr': 2.0},
    'balanced': {'score': 65, 'rr': 1.5},
    'aggressive': {'score': 50, 'rr': 1.25},
}


def _score_vwap(ind: IndicatorBundle) -> tuple[float, str]:
    if ind.vwap is None:
        return 0.0, 'no_vwap'
    if ind.price > ind.vwap:
        delta = (ind.price - ind.vwap) / ind.vwap
        score = min(20.0, 12.0 + delta * 2500)
        if ind.vwap_slope and ind.vwap_slope > 0:
            score += 2
        return min(20.0, score), 'above_vwap'
    return 2.0, 'below_vwap'


def _score_orderbook(ind: IndicatorBundle) -> float:
    return max(0.0, min(20.0, (ind.orderbook_imbalance + 1) * 10.0))


def _score_tradeflow(ind: IndicatorBundle) -> float:
    return max(0.0, min(15.0, (ind.tradeflow_imbalance + 1) * 7.5))


def _score_momentum(ind: IndicatorBundle) -> float:
    if ind.momentum_1m is None:
        return 0.0
    return max(0.0, min(10.0, 5.0 + ind.momentum_1m * 6000))


def _score_spread(ind: IndicatorBundle, asset: str) -> float:
    if ind.spread_bps is None:
        return 0.0
    cap = 12 if asset == 'IOTX-USD' else 20
    if ind.spread_bps > cap:
        return 0.0
    return max(0.0, min(10.0, 10.0 - (ind.spread_bps / cap) * 10.0))


def _score_volume(ind: IndicatorBundle) -> float:
    if ind.volume_recent <= 0:
        return 0.0
    return min(10.0, ind.volume_recent / 10.0)


def _score_ema(ind: IndicatorBundle) -> float:
    if ind.ema20 is None or ind.ema50 is None:
        return 0.0
    score = 1.0
    if ind.price > ind.ema20 > ind.ema50:
        score = 8.0
        if ind.ema20_slope and ind.ema20_slope > 0:
            score += 2.0
    elif ind.price > ind.ema20:
        score = 5.0
    return min(10.0, score)


def _score_rs(ind: IndicatorBundle) -> float:
    score = 0.0
    if ind.relative_strength_fast is not None and ind.relative_strength_fast > 0:
        score += 3.0
    if ind.relative_strength_slow is not None and ind.relative_strength_slow > 0:
        score += 2.0
    return score


def build_trade_plan(asset: str, ind: IndicatorBundle, aggressiveness: Agg, manual_profit_usd: float | None = None) -> StrategyDecision:
    vwap_score, vwap_reason = _score_vwap(ind)
    scores = {
        'vwap': vwap_score,
        'orderbook': _score_orderbook(ind),
        'tradeflow': _score_tradeflow(ind),
        'momentum': _score_momentum(ind),
        'spread': _score_spread(ind, asset),
        'volume': _score_volume(ind),
        'ema': _score_ema(ind),
        'rs': _score_rs(ind),
    }
    composite = round(sum(scores.values()), 2)
    recommendation = 'hold'
    setup_type = 'none'
    stop_price = None
    target_price = None
    rationale = {'vwap_reason': vwap_reason}

    if ind.vwap is not None:
        structural_stop = min(ind.vwap, ind.price * 0.995)
        if ind.ema20 is not None:
            structural_stop = min(structural_stop, ind.ema20 * 0.998)
        stop_price = structural_stop
        risk = max(ind.price - stop_price, ind.price * 0.002)
        rr = THRESHOLDS[aggressiveness]['rr']
        target_price = ind.price + (risk * rr)
        if manual_profit_usd and ind.price > 0:
            target_price = max(target_price, ind.price + manual_profit_usd)

    if composite >= THRESHOLDS[aggressiveness]['score']:
        recommendation = 'enter_long'
        if ind.vwap and ind.price > ind.vwap and ind.ema20 and ind.price > ind.ema20:
            setup_type = 'vwap_reclaim_long'
        elif ind.price > (ind.ema20 or ind.price):
            setup_type = 'continuation_long'
        else:
            setup_type = 'breakout_long'

    return StrategyDecision(
        recommendation=recommendation,
        setup_type=setup_type,
        composite_score=composite,
        score_breakdown=scores,
        stop_price=stop_price,
        target_price=target_price,
        rationale=rationale,
    )
