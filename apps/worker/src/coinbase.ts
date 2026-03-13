import { Asset } from './types';

export interface TickerSnapshot {
  productId: Asset;
  price: number;
  bestBid: number;
  bestAsk: number;
  bidDepth: number;
  askDepth: number;
  benchmarkPrice: number;
  timestamp: string;
}

export async function fetchPublicTicker(asset: Asset): Promise<TickerSnapshot> {
  // Replace with real Coinbase Advanced Trade REST or WS integration.
  const price = asset === 'ETH-USD' ? 3650 : 0.028;
  return {
    productId: asset,
    price,
    bestBid: price * 0.9995,
    bestAsk: price * 1.0005,
    bidDepth: asset === 'ETH-USD' ? 100000 : 15000,
    askDepth: asset === 'ETH-USD' ? 98000 : 14500,
    benchmarkPrice: asset === 'ETH-USD' ? 64000 : 3650,
    timestamp: new Date().toISOString()
  };
}

export async function placeCoinbaseOrder(_params: { side: 'BUY' | 'SELL'; asset: Asset; notionalUsd: number; mode: 'paper' | 'live' }) {
  // Replace with signed Advanced Trade order call.
  return {
    success: true,
    exchangeOrderId: crypto.randomUUID(),
    status: 'FILLED'
  };
}
