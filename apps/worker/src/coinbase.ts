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

type CoinbaseBestBidAskResponse = {
  pricebooks?: Array<{
    product_id: string;
    bids?: Array<{ price: string; size: string }>;
    asks?: Array<{ price: string; size: string }>;
    time?: string;
  }>;
};

async function fetchBestBidAsk(productId: string) {
  const url = `https://api.coinbase.com/api/v3/brokerage/best_bid_ask?product_ids=${encodeURIComponent(productId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Coinbase best_bid_ask failed: ${res.status}`);
  }

  const data = (await res.json()) as CoinbaseBestBidAskResponse;
  const book = data.pricebooks?.[0];

  if (!book) {
    throw new Error(`No pricebook returned for ${productId}`);
  }

  const bestBid = Number(book.bids?.[0]?.price ?? 0);
  const bestAsk = Number(book.asks?.[0]?.price ?? 0);
  const bidDepth = Number(book.bids?.[0]?.size ?? 0);
  const askDepth = Number(book.asks?.[0]?.size ?? 0);

  if (!bestBid || !bestAsk) {
    throw new Error(`Invalid bid/ask for ${productId}`);
  }

  return {
    bestBid,
    bestAsk,
    bidDepth,
    askDepth,
    timestamp: book.time ?? new Date().toISOString()
  };
}

async function fetchBenchmarkPrice(productId: 'BTC-USD' | 'ETH-USD') {
  const data = await fetchBestBidAsk(productId);
  return (data.bestBid + data.bestAsk) / 2;
}

export async function fetchPublicTicker(asset: Asset): Promise<TickerSnapshot> {
  const book = await fetchBestBidAsk(asset);
  const price = (book.bestBid + book.bestAsk) / 2;

  const benchmarkAsset: 'BTC-USD' | 'ETH-USD' =
    asset === 'ETH-USD' ? 'BTC-USD' : 'ETH-USD';

  let benchmarkPrice = price;
  try {
    benchmarkPrice = await fetchBenchmarkPrice(benchmarkAsset);
  } catch {
    benchmarkPrice = asset === 'ETH-USD' ? 60000 : 3500;
  }

  return {
    productId: asset,
    price,
    bestBid: book.bestBid,
    bestAsk: book.bestAsk,
    bidDepth: book.bidDepth,
    askDepth: book.askDepth,
    benchmarkPrice,
    timestamp: book.timestamp
  };
}

export async function placeCoinbaseOrder(params: {
  side: 'BUY' | 'SELL';
  asset: Asset;
  notionalUsd: number;
  mode: 'paper' | 'live';
}) {
  if (params.mode === 'paper') {
    return {
      success: true,
      exchangeOrderId: crypto.randomUUID(),
      status: 'FILLED',
      price: null,
      quantity: null,
      avgFillPrice: null,
      filledQuantity: null,
      feeUsd: 0,
      slippageUsd: 0
    };
  }

  throw new Error('Live Coinbase order placement is not implemented yet.');
}
