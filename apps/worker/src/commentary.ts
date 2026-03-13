export function buildCommentary(input: {
  asset: string;
  regime: string;
  regimeConfidence: number;
  price: number;
  vwap: number;
  ema20: number;
  ema50: number;
  rsFast: number;
  score: number;
  threshold: number;
  entryEligible: boolean;
  mode: string;
}) {
  const { asset, regime, regimeConfidence, price, vwap, ema20, ema50, rsFast, score, threshold, entryEligible, mode } = input;
  const market = `${asset} is in ${regime} with ${Math.round(regimeConfidence * 100)}% confidence. Price ${price >= vwap ? 'remains above' : 'sits below'} VWAP and EMA alignment is ${price > ema20 && ema20 > ema50 ? 'supportive' : 'mixed'}.`;
  const posture = `Bot posture is ${mode}. Relative strength is ${rsFast >= 0 ? 'positive' : 'negative'} and current signal score is ${score.toFixed(1)}.`;
  const decision = entryEligible
    ? `Setup is entry-eligible because score ${score.toFixed(1)} cleared threshold ${threshold.toFixed(1)}.`
    : `No trade taken. Score ${score.toFixed(1)} is below threshold ${threshold.toFixed(1)} or a hard risk gate is active.`;
  const position = 'No live position is described in this template. Use the open positions panel for exact exposure.';
  const risk = `Live trading should remain off until paper-mode behavior is stable. Current regime suggests ${regime.includes('Range') ? 'more caution' : 'normal selectivity'}.`;
  return { market, posture, decision, position, risk };
}
