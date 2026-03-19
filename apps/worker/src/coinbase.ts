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

type PublicProductBookResponse = {
  pricebook?: {
    product_id?: string;
    bids?: Array<{ price?: string; size?: string }>;
    asks?: Array<{ price?: string; size?: string }>;
    time?: string;
  };
};

type PublicProductResponse = {
  product_id?: string;
  price?: string;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache'
    }
  });

  if (!res.ok) {
    throw new Error(`Coinbase public endpoint failed: ${res.status} ${url}`);
  }

  return (await res.json()) as T;
}

async function fetchPublicProductBook(productId: string) {
  const url =
    `https://api.coinbase.com/api/v3/brokerage/market/product_book?product_id=${encodeURIComponent(productId)}`;

  const data = await fetchJson<PublicProductBookResponse>(url);
  const book = data.pricebook;

  if (!book) {
    throw new Error(`No public product book returned for ${productId}`);
  }

  const bestBid = num(book.bids?.[0]?.price);
  const bestAsk = num(book.asks?.[0]?.price);
  const bidDepth = num(book.bids?.[0]?.size);
  const askDepth = num(book.asks?.[0]?.size);

  if (!bestBid || !bestAsk) {
    throw new Error(`Invalid public product book for ${productId}`);
  }

  return {
    bestBid,
    bestAsk,
    bidDepth,
    askDepth,
    timestamp: book.time ?? new Date().toISOString()
  };
}

async function fetchPublicProductPrice(productId: string) {
  const url =
    `https://api.coinbase.com/api/v3/brokerage/market/products/${encodeURIComponent(productId)}`;

  const data = await fetchJson<PublicProductResponse>(url);
  const price = num(data.price);

  if (!price) {
    throw new Error(`Invalid public product price for ${productId}`);
  }

  return price;
}

async function fetchBenchmarkPrice(productId: 'BTC-USD' | 'ETH-USD') {
  return fetchPublicProductPrice(productId);
}

export async function fetchPublicTicker(asset: Asset): Promise<TickerSnapshot> {
  const [book, referencePrice] = await Promise.all([
    fetchPublicProductBook(asset),
    fetchPublicProductPrice(asset)
  ]);

  const mid = (book.bestBid + book.bestAsk) / 2;
  const price = referencePrice || mid;

  const benchmarkAsset: 'BTC-USD' | 'ETH-USD' =
    asset === 'ETH-USD' ? 'BTC-USD' : 'ETH-USD';

  let benchmarkPrice = price;
  try {
    benchmarkPrice = await fetchBenchmarkPrice(benchmarkAsset);
  } catch {
    benchmarkPrice = asset === 'ETH-USD' ? 60000 : 2500;
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
