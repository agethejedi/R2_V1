import { DurableObject } from 'cloudflare:workers';
import { buildCommentary } from './commentary';
import { fetchPublicTicker, placeCoinbaseOrder } from './coinbase';
import {
  closeOpenPosition,
  getOpenPosition,
  getSettings,
  insertDecision,
  insertOrder,
  resetDailyRisk,
  updateSettings,
  upsertPosition,
  writeLog
} from './db';
import {
  classifyRegime,
  ema,
  momentum,
  orderBookImbalance,
  relativeStrength,
  vwap
} from './indicators';
import type {
  Aggressiveness,
  Asset,
  BotStatus,
  Env,
  TradingMode
} from './types';

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
  stateData: BotState = {
    prices: [],
    volumes: [],
    lastStatus: null,
    sockets: new Set(),
    heartbeatAt: Date.now()
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    void this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<BotStatus>('lastStatus');
      if (saved) {
        this.stateData.lastStatus = saved;
      }
    });
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

    if (url.pathname.endsWith('/tick') && request.method === 'POST') {
      const status = await this.tick();
      return Response.json(status);
    }

    if (url.pathname.endsWith('/status') && request.method === 'GET') {
      return Response.json(await this.tick());
    }

    if (url.pathname.endsWith('/trade') && request.method === 'POST') {
      const body = await request.json<{ side: 'BUY' | 'SELL'; notionalUsd: number }>();
      return Response.json(await this.executeTrade(body.side, body.notionalUsd));
    }

    if (url.pathname.endsWith('/settings') && request.method === 'PATCH') {
      const patch = await request.json<Record<string, unknown>>();
      const updated = await updateSettings(this.env, patch);
      await writeLog(this.env, 'info', 'settings', 'settings updated', patch);
      return Response.json(updated);
    }

    if (url.pathname.endsWith('/close-position') && request.method === 'POST') {
      const status = this.stateData.lastStatus;
      const open = await getOpenPosition(this.env);

      let realizedPnl = 0;
      if (open && typeof open === 'object') {
        const avgEntry = Number((open as Record<string, unknown>).avg_entry_price ?? 0);
        const qty = Number((open as Record<string, unknown>).quantity ?? 0);
        const exitPrice = Number(status?.lastPrice ?? 0);
        realizedPnl = qty > 0 && avgEntry > 0 && exitPrice > 0
          ? (exitPrice - avgEntry) * qty
          : 0;
      }

      const closed = await closeOpenPosition(this.env, {
        exit_reason: 'manual_close',
        last_price: status?.lastPrice ?? null,
        realized_pnl: realizedPnl
      });

      await writeLog(this.env, 'info', 'positions', 'manual close position requested', {
        closed,
        realizedPnl
      });

      return Response.json({
        ok: true,
        closed
      });
    }

    if (url.pathname.endsWith('/reset-risk') && request.method === 'POST') {
      const result = await resetDailyRisk(this.env);
      await writeLog(this.env, 'info', 'risk', 'daily risk reset', result);
      return Response.json(result);
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {}

  async webSocketClose(ws: WebSocket) {
    this.stateData.sockets.delete(ws);
  }

  async alarm() {
    await this.tick();
  }

  async tick(): Promise<BotStatus> {
    const settings = await getSettings(this.env);

    const asset = (settings?.active_asset ?? 'ETH-USD') as Asset;
    const mode = (settings?.mode ?? 'paper') as TradingMode;
    const aggressiveness = (settings?.aggressiveness ?? 'balanced') as Aggressiveness;
    const liveSwitchEnabled = Boolean(settings?.live_switch_enabled);
    const killSwitchEnabled = Boolean(settings?.kill_switch_enabled);

    let snapshot;
    try {
      snapshot = await fetchPublicTicker(asset);
    } catch (err) {
      await writeLog(this.env, 'error', 'tick', 'fetchPublicTicker failed', {
        asset,
        error: err instanceof Error ? err.message : String(err)
      });

      const fallbackPrice =
        this.stateData.lastStatus?.lastPrice ??
        (asset === 'ETH-USD' ? 2500 : 0.03);

      snapshot = {
        productId: asset,
        price: fallbackPrice,
        bestBid: fallbackPrice * 0.9995,
        bestAsk: fallbackPrice * 1.0005,
        bidDepth: 1000,
        askDepth: 1000,
        benchmarkPrice: asset === 'ETH-USD' ? 60000 : 2500,
        timestamp: new Date().toISOString()
      };
    }

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

    const spreadBps =
      ((snapshot.bestAsk - snapshot.bestBid) / snapshot.price) * 10000;

    const ob = orderBookImbalance(snapshot.bidDepth, snapshot.askDepth);
    const m = momentum(prices);
    const rsFast = relativeStrength(m, asset === 'ETH-USD' ? 0.001 : 0.0005);
    const rsSlow = rsFast / 2;
    const volScore = Math.abs(m);

    const regime = classifyRegime({
      price: snapshot.price,
      ema20,
      ema50,
      vwap: currentVwap,
      rsFast,
      volScore,
      spreadBps
    });

    const signalScore = Math.max(
      0,
      Math.min(
        100,
        20 * Number(snapshot.price >= currentVwap) +
          20 * Math.max(0, ob) +
          15 * Math.max(0, rsFast * 50) +
          10 * Math.max(0, m * 100) +
          10 * Number(spreadBps < (asset === 'ETH-USD' ? 15 : 40)) +
          10 * Number((volumes.at(-1) ?? 0) > (volumes[0] ?? 0)) +
          10 * Number(snapshot.price > ema20 && ema20 > ema50) +
          5 * Number(rsFast >= rsSlow)
      )
    );

    const threshold = THRESHOLDS[aggressiveness];

    const entryEligible =
      !killSwitchEnabled &&
      mode !== 'paused' &&
      signalScore >= threshold &&
      !(mode === 'live' && !liveSwitchEnabled);

    // Mark-to-market open position
    const open = await getOpenPosition(this.env);
    if (open && typeof open === 'object') {
      const openPos = open as Record<string, unknown>;
      const avgEntry = Number(openPos.avg_entry_price ?? 0);
      const qty = Number(openPos.quantity ?? 0);
      const currentPrice = Number(snapshot.price ?? 0);
      const peakPrice = Math.max(
        Number(openPos.peak_price ?? 0),
        currentPrice
      );

      const unrealizedPnl =
        qty > 0 && avgEntry > 0 && currentPrice > 0
          ? (currentPrice - avgEntry) * qty
          : 0;

      await upsertPosition(this.env, {
        id: String(openPos.id),
        asset: String(openPos.asset ?? asset),
        mode: String(openPos.mode ?? mode),
        quantity: qty,
        avg_entry_price: avgEntry,
        stop_price: Number(openPos.stop_price ?? 0) || null,
        target_price: Number(openPos.target_price ?? 0) || null,
        peak_price: peakPrice || null,
        last_price: currentPrice || null,
        status: String(openPos.status ?? 'OPEN'),
        realized_pnl: Number(openPos.realized_pnl ?? 0),
        unrealized_pnl: unrealizedPnl,
        entry_reason: String(openPos.entry_reason ?? 'manual_trade'),
        exit_reason: openPos.exit_reason ? String(openPos.exit_reason) : null,
        opened_at: String(openPos.opened_at ?? new Date().toISOString()),
        closed_at: openPos.closed_at ? String(openPos.closed_at) : null
      });
    }

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

    const reason = entryEligible
      ? `Score ${signalScore.toFixed(1)} meets threshold ${threshold}`
      : `Score ${signalScore.toFixed(1)} is below threshold ${threshold}`;

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

    await insertDecision(this.env, {
      asset,
      mode,
      allowed: entryEligible,
      reason,
      setup_type: regime.regime,
      aggressiveness,
      score: signalScore,
      regime: regime.regime,
      commentary: commentary?.decision ?? commentary?.market ?? null
    });

    await writeLog(this.env, 'info', 'tick', 'tick evaluated', {
      asset,
      mode,
      signalScore,
      threshold,
      regime: regime.regime,
      entryEligible
    });

    await this.ctx.storage.setAlarm(Date.now() + 15_000);
    this.broadcast(status);

    return status;
  }

  async executeTrade(side: 'BUY' | 'SELL', notionalUsd: number) {
    const settings = await getSettings(this.env);
    const asset = (settings?.active_asset ?? 'ETH-USD') as Asset;
    const mode = (settings?.mode ?? 'paper') as 'paper' | 'live';

    const result = await placeCoinbaseOrder({
      side,
      asset,
      notionalUsd,
      mode
    });

    const fillPrice = Number(
      result?.avgFillPrice ??
      result?.price ??
      this.stateData.lastStatus?.lastPrice ??
      0
    );

    const quantity =
      Number(result?.filledQuantity ?? result?.quantity ?? 0) ||
      (fillPrice > 0 ? notionalUsd / fillPrice : 0);

    const orderStatus = result?.status ?? 'FILLED';

    await insertOrder(this.env, {
      exchange_order_id:
        result?.exchangeOrderId ??
        result?.exchange_order_id ??
        null,
      asset,
      mode,
      side,
      order_type: 'MARKET',
      requested_notional_usd: notionalUsd,
      requested_quantity: quantity || null,
      filled_quantity: quantity || null,
      avg_fill_price: fillPrice || null,
      fee_usd: Number(result?.feeUsd ?? 0),
      slippage_usd: Number(result?.slippageUsd ?? 0),
      status: orderStatus
    });

    if (side === 'BUY' && fillPrice > 0 && quantity > 0) {
      await upsertPosition(this.env, {
        asset,
        mode,
        quantity,
        avg_entry_price: fillPrice,
        stop_price: null,
        target_price: null,
        peak_price: fillPrice,
        last_price: fillPrice,
        status: 'OPEN',
        realized_pnl: 0,
        unrealized_pnl: 0,
        entry_reason: 'manual_trade'
      });

      await writeLog(this.env, 'info', 'positions', 'position opened', {
        asset,
        mode,
        quantity,
        fillPrice
      });
    }

    if (side === 'SELL') {
      const open = await getOpenPosition(this.env);

      let realizedPnl = 0;
      if (open && typeof open === 'object') {
        const avgEntry = Number((open as Record<string, unknown>).avg_entry_price ?? 0);
        const qty = Number((open as Record<string, unknown>).quantity ?? 0);
        realizedPnl =
          qty > 0 && avgEntry > 0 && fillPrice > 0
            ? (fillPrice - avgEntry) * qty
            : 0;
      }

      await closeOpenPosition(this.env, {
        exit_reason: 'manual_trade_sell',
        last_price: fillPrice || this.stateData.lastStatus?.lastPrice || null,
        realized_pnl: realizedPnl
      });

      await writeLog(this.env, 'info', 'positions', 'position closed', {
        asset,
        mode,
        fillPrice,
        realizedPnl
      });
    }

    await writeLog(this.env, 'info', 'execution', `${mode} ${side} executed`, {
      asset,
      notionalUsd,
      result
    });

    return {
      ok: true,
      asset,
      mode,
      side,
      notionalUsd,
      result
    };
  }

  broadcast(status: BotStatus) {
    const payload = JSON.stringify({ type: 'status', payload: status });

    for (const socket of this.stateData.sockets) {
      try {
        socket.send(payload);
      } catch {
        // ignore broken sockets
      }
    }
  }
}
