from __future__ import annotations

from dataclasses import dataclass

from app.services.indicators import IndicatorBundle


@dataclass
class RegimeAssessment:
    regime: str
    confidence: str
    posture: str
    factors: dict[str, float | str | None]


def classify_regime(ind: IndicatorBundle) -> RegimeAssessment:
    trend_score = 0
    vol_flag = 0
    chop_score = 0

    if ind.ema20 is not None and ind.ema50 is not None:
        if ind.price > ind.ema20 > ind.ema50:
            trend_score += 2
        elif ind.price < ind.ema20 < ind.ema50:
            trend_score -= 2
        else:
            chop_score += 2

    if ind.ema20_slope is not None:
        if ind.ema20_slope > 0:
            trend_score += 1
        elif ind.ema20_slope < 0:
            trend_score -= 1

    if ind.vwap is not None:
        if ind.price > ind.vwap:
            trend_score += 1
        else:
            trend_score -= 1

    if ind.vwap_slope is not None and abs(ind.vwap_slope) < 0.00015:
        chop_score += 1

    if ind.momentum_1m is not None and abs(ind.momentum_1m) < 0.0008:
        chop_score += 1

    if ind.realized_vol_5m is not None and ind.realized_vol_5m > 0.01:
        vol_flag += 2
    if ind.spread_bps is not None and ind.spread_bps > 18:
        vol_flag += 1

    if vol_flag >= 2:
        regime = 'High Volatility / Event Risk'
        confidence = 'high' if vol_flag >= 3 else 'medium'
        posture = 'reduce size sharply or pause entries'
    elif trend_score >= 3:
        regime = 'Trend Up'
        confidence = 'high' if trend_score >= 4 else 'medium'
        posture = 'allow continuation and reclaim longs'
    elif trend_score <= -3:
        regime = 'Trend Down'
        confidence = 'high' if trend_score <= -4 else 'medium'
        posture = 'block or heavily reduce long entries'
    else:
        regime = 'Range / Chop'
        confidence = 'medium' if chop_score >= 2 else 'low'
        posture = 'raise thresholds and slow re-entry'

    return RegimeAssessment(
        regime=regime,
        confidence=confidence,
        posture=posture,
        factors={
            'price': ind.price,
            'ema20': ind.ema20,
            'ema50': ind.ema50,
            'ema20_slope': ind.ema20_slope,
            'vwap': ind.vwap,
            'vwap_slope': ind.vwap_slope,
            'spread_bps': ind.spread_bps,
            'relative_strength_fast': ind.relative_strength_fast,
            'relative_strength_slow': ind.relative_strength_slow,
            'realized_vol_5m': ind.realized_vol_5m,
        },
    )
