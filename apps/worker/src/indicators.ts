export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i += 1) result = values[i] * k + result * (1 - k);
  return result;
}

export function vwap(prices: number[], volumes: number[]): number {
  let pv = 0;
  let v = 0;
  for (let i = 0; i < prices.length; i += 1) {
    pv += prices[i] * (volumes[i] ?? 0);
    v += volumes[i] ?? 0;
  }
  return v > 0 ? pv / v : (prices.at(-1) ?? 0);
}

export function orderBookImbalance(bidDepth: number, askDepth: number): number {
  const denom = bidDepth + askDepth;
  return denom === 0 ? 0 : (bidDepth - askDepth) / denom;
}

export function relativeStrength(assetFast: number, benchmarkFast: number): number {
  return assetFast - benchmarkFast;
}

export function momentum(prices: number[]): number {
  if (prices.length < 2) return 0;
  const start = prices[0];
  const end = prices[prices.length - 1];
  return start === 0 ? 0 : (end - start) / start;
}

export function classifyRegime(input: {
  price: number;
  ema20: number;
  ema50: number;
  vwap: number;
  rsFast: number;
  volScore: number;
  spreadBps: number;
}) {
  const { price, ema20, ema50, vwap, rsFast, volScore, spreadBps } = input;
  if (spreadBps > 40 || volScore > 0.04) return { regime: 'High Volatility / Event Risk', confidence: 0.72 };
  if (price > ema20 && ema20 > ema50 && price > vwap && rsFast >= 0) return { regime: 'Trend Up', confidence: 0.77 };
  if (price < ema20 && ema20 < ema50 && price < vwap && rsFast < 0) return { regime: 'Trend Down', confidence: 0.76 };
  return { regime: 'Range / Chop', confidence: 0.66 };
}
