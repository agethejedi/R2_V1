import { DurableObject } from 'cloudflare:workers';
import { buildCommentary } from './commentary';
import { fetchPublicTicker, placeCoinbaseOrder } from './coinbase';
import { getSettings, writeLog } from './db';
import { classifyRegime, ema, momentum, orderBookImbalance, relativeStrength, vwap } from './indicators';
import { Aggressiveness, Asset, BotStatus, Env, TradingMode } from './types';

interface BotState {
  prices: number[];
  volumes: number[];
  lastStatus: BotStatus | null;
  sockets: Set<WebSocket>;
  heartbeatAt: number;
}

const THRESHOLDS: Record<Aggressiveness, number> = {
  conservative: 80,
  balanced: 65,
  aggressive: 50
};

export class BotDurableObject extends DurableObject<Env> {
  stateData: BotState = { prices: [], volumes: [], lastStatus: null, sockets: new Set(), heartbeatAt: Date.now() };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/ws')) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      this.stateData.sockets.add(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname.endsWith('/tick')) {
      const status = await this.tick();
      return Response.json(status);
    }
    if (url.pathname.endsWith('/status')) {
      return Response.json(this.stateData.lastStatus ?? await this.tick());
    }
    if (url.pathname.endsWith('/trade') && request.method === 'POST') {
      const body = await request.json<{ side: 'BUY'|'SELL'; notionalUsd: number }>();
      return Response.json(await this.executeTrade(body.side, body.notionalUsd));
    }
    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {}
  async webSocketClose(ws: WebSocket) { this.stateData.sockets.delete(ws); }

  async alarm() { await this.tick(); }

  async tick(): Promise<BotStatus> {
    const settings = await getSettings(this.env);
    const asset = (settings?.active_asset ?? 'ETH-USD') as Asset;
    const mode = (settings?.mode ?? 'paper') as TradingMode;
    const aggressiveness = (settings?.aggressiveness ?? 'balanced') as Aggressiveness;
    const liveSwitchEnabled = Boolean(settings?.live_switch_enabled);
    const killSwitchEnabled = Boolean(settings?.kill_switch_enabled);

    const snapshot = await fetchPublicTicker(asset);
    this.stateData.prices.push(snapshot.price);
    this.stateData.volumes.push(Math.max(1, snapshot.bidDepth + snapshot.askDepth));
    this.stateData.prices = this.stateData.prices.slice(-60);
    this.stateData.volumes = this.stateData.volumes.slice(-60);
    this.stateData.heartbeatAt = Date.now();

    const prices = this.stateData.prices;
    const volumes = this.stateData.volumes;
    const ema20 = ema(prices, 20);
    const ema50 = ema(prices, 50);
    const currentVwap = vwap(prices, volumes);
    const spreadBps = ((snapshot.bestAsk - snapshot.bestBid) / snapshot.price) * 10000;
    const ob = orderBookImbalance(snapshot.bidDepth, snapshot.askDepth);
    const m = momentum(prices);
    const rsFast = relativeStrength(m, asset === 'ETH-USD' ? 0.001 : 0.0005);
    const rsSlow = rsFast / 2;
    const volScore = Math.abs(m);
    const regime = classifyRegime({ price: snapshot.price, ema20, ema50, vwap: currentVwap, rsFast, volScore, spreadBps });

    const signalScore = Math.max(0, Math.min(100,
      20 * Number(snapshot.price >= currentVwap) +
      20 * Math.max(0, ob) +
      15 * Math.max(0, rsFast * 50) +
      10 * Math.max(0, m * 100) +
      10 * Number(spreadBps < (asset === 'ETH-USD' ? 15 : 40)) +
      10 * Number(volumes.at(-1)! > volumes[0]) +
      10 * Number(snapshot.price > ema20 && ema20 > ema50) +
      5 * Number(rsFast >= rsSlow)
    ));

    const threshold = THRESHOLDS[aggressiveness];
    const entryEligible = !killSwitchEnabled && (mode !== 'paused') && signalScore >= threshold && (!((mode === 'live') && !liveSwitchEnabled));
    const commentary = buildCommentary({
      asset,
      regime: regime.regime,
      regimeConfidence: regime.confidence,
      price: snapshot.price,
      vwap: currentVwap,
      ema20,
      ema50,
      rsFast,
      score: signalScore,
      threshold,
      entryEligible,
      mode
    });

    const status: BotStatus = {
      asset,
      mode,
      liveSwitchEnabled,
      killSwitchEnabled,
      regime: regime.regime,
      regimeConfidence: regime.confidence,
      lastPrice: snapshot.price,
      lastUpdated: snapshot.timestamp,
      commentary,
      signalScore,
      entryEligible
    };

    this.stateData.lastStatus = status;
    await this.ctx.storage.put('lastStatus', status);
    await this.ctx.storage.setAlarm(Date.now() + 15_000);
    this.broadcast(status);
    return status;
  }

  async executeTrade(side: 'BUY'|'SELL', notionalUsd: number) {
    const settings = await getSettings(this.env);
    const asset = (settings?.active_asset ?? 'ETH-USD') as Asset;
    const mode = (settings?.mode ?? 'paper') as 'paper' | 'live';
    const result = await placeCoinbaseOrder({ side, asset, notionalUsd, mode });
    await writeLog(this.env, 'info', 'execution', `${mode} ${side} executed`, { asset, notionalUsd, result });
    return { ok: true, asset, mode, side, notionalUsd, result };
  }

  broadcast(status: BotStatus) {
    const payload = JSON.stringify({ type: 'status', payload: status });
    for (const socket of this.stateData.sockets) {
      try { socket.send(payload); } catch {}
    }
  }
}
