import { Env } from './types';

type SettingsRow = {
  id: string;
  active_asset: string;
  mode: string;
  aggressiveness: string;
  live_switch_enabled: number;
  kill_switch_enabled: number;
  max_trade_amount_usd: number;
  max_loss_per_trade_usd: number;
  desired_profit_per_trade_usd: number;
  max_daily_loss_usd: number;
  trade_amount_mode: string;
  profit_target_mode: string;
  updated_at: string;
};

type SettingsPatch = Partial<{
  active_asset: string;
  mode: string;
  aggressiveness: string;
  live_switch_enabled: number | boolean;
  kill_switch_enabled: number | boolean;
  max_trade_amount_usd: number;
  max_loss_per_trade_usd: number;
  desired_profit_per_trade_usd: number;
  max_daily_loss_usd: number;
  trade_amount_mode: string;
  profit_target_mode: string;
}>;

function toIntBool(value: unknown, fallback = 0): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  return fallback;
}

export async function ensureDefaultSettings(env: Env) {
  const row = await env.DB.prepare('SELECT id FROM settings LIMIT 1').first();

  if (!row) {
    await env.DB.prepare(
      `INSERT INTO settings (
        id,
        active_asset,
        mode,
        aggressiveness,
        live_switch_enabled,
        kill_switch_enabled,
        max_trade_amount_usd,
        max_loss_per_trade_usd,
        desired_profit_per_trade_usd,
        max_daily_loss_usd,
        trade_amount_mode,
        profit_target_mode,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        'ETH-USD',
        'paper',
        'balanced',
        0,
        0,
        100,
        10,
        15,
        30,
        'manual',
        'manual',
        new Date().toISOString()
      )
      .run();
  }
}

export async function getSettings(env: Env): Promise<SettingsRow | null> {
  await ensureDefaultSettings(env);
  return (await env.DB.prepare('SELECT * FROM settings LIMIT 1').first()) as SettingsRow | null;
}

export async function updateSettings(env: Env, patch: SettingsPatch): Promise<SettingsRow | null> {
  await ensureDefaultSettings(env);

  const current = await getSettings(env);
  if (!current) return null;

  const next: SettingsRow = {
    ...current,
    ...patch,
    live_switch_enabled: toIntBool(
      patch.live_switch_enabled,
      Number(current.live_switch_enabled ?? 0)
    ),
    kill_switch_enabled: toIntBool(
      patch.kill_switch_enabled,
      Number(current.kill_switch_enabled ?? 0)
    ),
    updated_at: new Date().toISOString()
  };

  await env.DB.prepare(
    `UPDATE settings SET
      active_asset = ?,
      mode = ?,
      aggressiveness = ?,
      live_switch_enabled = ?,
      kill_switch_enabled = ?,
      max_trade_amount_usd = ?,
      max_loss_per_trade_usd = ?,
      desired_profit_per_trade_usd = ?,
      max_daily_loss_usd = ?,
      trade_amount_mode = ?,
      profit_target_mode = ?,
      updated_at = ?
     WHERE id = ?`
  )
    .bind(
      next.active_asset,
      next.mode,
      next.aggressiveness,
      next.live_switch_enabled,
      next.kill_switch_enabled,
      next.max_trade_amount_usd,
      next.max_loss_per_trade_usd,
      next.desired_profit_per_trade_usd,
      next.max_daily_loss_usd,
      next.trade_amount_mode,
      next.profit_target_mode,
      next.updated_at,
      next.id
    )
    .run();

  return getSettings(env);
}

export async function getOrders(env: Env, limit = 50) {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?'
    )
      .bind(limit)
      .all();

    return result.results ?? [];
  } catch (err) {
    await writeLog(env, 'error', 'db', 'getOrders failed', {
      error: err instanceof Error ? err.message : String(err)
    });
    return [];
  }
}

export async function getPositions(env: Env) {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM positions ORDER BY opened_at DESC LIMIT 10'
    ).all();

    return result.results ?? [];
  } catch (err) {
    await writeLog(env, 'error', 'db', 'getPositions failed', {
      error: err instanceof Error ? err.message : String(err)
    });
    return [];
  }
}

export async function getDecisions(env: Env, limit = 20) {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?'
    )
      .bind(limit)
      .all();

    return result.results ?? [];
  } catch (err) {
    await writeLog(env, 'error', 'db', 'getDecisions failed', {
      error: err instanceof Error ? err.message : String(err)
    });
    return [];
  }
}

export async function insertDecision(
  env: Env,
  input: {
    asset: string;
    mode: string;
    allowed: boolean | number;
    reason: string;
    setup_type?: string | null;
    aggressiveness?: string | null;
    score?: number | null;
    regime?: string | null;
    commentary?: string | null;
  }
) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO decisions (
      id,
      asset,
      mode,
      allowed,
      reason,
      setup_type,
      aggressiveness,
      score,
      regime,
      commentary,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.asset,
      input.mode,
      toIntBool(input.allowed),
      input.reason,
      input.setup_type ?? null,
      input.aggressiveness ?? null,
      input.score ?? null,
      input.regime ?? null,
      input.commentary ?? null,
      createdAt
    )
    .run();

  return { id, created_at: createdAt };
}

export async function insertOrder(
  env: Env,
  input: {
    exchange_order_id?: string | null;
    asset: string;
    mode: string;
    side: string;
    order_type: string;
    requested_notional_usd?: number | null;
    requested_quantity?: number | null;
    filled_quantity?: number | null;
    avg_fill_price?: number | null;
    fee_usd?: number | null;
    slippage_usd?: number | null;
    status: string;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO orders (
      id,
      exchange_order_id,
      asset,
      mode,
      side,
      order_type,
      requested_notional_usd,
      requested_quantity,
      filled_quantity,
      avg_fill_price,
      fee_usd,
      slippage_usd,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.exchange_order_id ?? null,
      input.asset,
      input.mode,
      input.side,
      input.order_type,
      input.requested_notional_usd ?? null,
      input.requested_quantity ?? null,
      input.filled_quantity ?? null,
      input.avg_fill_price ?? null,
      input.fee_usd ?? null,
      input.slippage_usd ?? null,
      input.status,
      now,
      now
    )
    .run();

  return { id, created_at: now, updated_at: now };
}

export async function upsertPosition(
  env: Env,
  input: {
    id?: string;
    asset: string;
    mode: string;
    quantity: number;
    avg_entry_price: number;
    stop_price?: number | null;
    target_price?: number | null;
    peak_price?: number | null;
    last_price?: number | null;
    status: string;
    realized_pnl?: number | null;
    unrealized_pnl?: number | null;
    entry_reason?: string | null;
    exit_reason?: string | null;
    opened_at?: string;
    closed_at?: string | null;
  }
) {
  const id = input.id ?? crypto.randomUUID();
  const openedAt = input.opened_at ?? new Date().toISOString();

  const existing = await env.DB.prepare(
    'SELECT id FROM positions WHERE id = ? LIMIT 1'
  )
    .bind(id)
    .first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE positions SET
        asset = ?,
        mode = ?,
        quantity = ?,
        avg_entry_price = ?,
        stop_price = ?,
        target_price = ?,
        peak_price = ?,
        last_price = ?,
        status = ?,
        realized_pnl = ?,
        unrealized_pnl = ?,
        entry_reason = ?,
        exit_reason = ?,
        closed_at = ?
       WHERE id = ?`
    )
      .bind(
        input.asset,
        input.mode,
        input.quantity,
        input.avg_entry_price,
        input.stop_price ?? null,
        input.target_price ?? null,
        input.peak_price ?? null,
        input.last_price ?? null,
        input.status,
        input.realized_pnl ?? 0,
        input.unrealized_pnl ?? 0,
        input.entry_reason ?? null,
        input.exit_reason ?? null,
        input.closed_at ?? null,
        id
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO positions (
        id,
        asset,
        mode,
        quantity,
        avg_entry_price,
        stop_price,
        target_price,
        peak_price,
        last_price,
        status,
        realized_pnl,
        unrealized_pnl,
        entry_reason,
        exit_reason,
        opened_at,
        closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        input.asset,
        input.mode,
        input.quantity,
        input.avg_entry_price,
        input.stop_price ?? null,
        input.target_price ?? null,
        input.peak_price ?? null,
        input.last_price ?? null,
        input.status,
        input.realized_pnl ?? 0,
        input.unrealized_pnl ?? 0,
        input.entry_reason ?? null,
        input.exit_reason ?? null,
        openedAt,
        input.closed_at ?? null
      )
      .run();
  }

  return id;
}

export async function getOpenPosition(env: Env) {
  return env.DB.prepare(
    "SELECT * FROM positions WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1"
  ).first();
}

export async function closeOpenPosition(
  env: Env,
  input?: {
    exit_reason?: string;
    last_price?: number | null;
    realized_pnl?: number | null;
  }
) {
  const open = await getOpenPosition(env);
  if (!open || typeof open !== 'object') return null;

  const closedAt = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE positions SET
      status = 'CLOSED',
      exit_reason = ?,
      last_price = ?,
      realized_pnl = ?,
      closed_at = ?
     WHERE id = ?`
  )
    .bind(
      input?.exit_reason ?? 'manual_close',
      input?.last_price ?? null,
      input?.realized_pnl ?? 0,
      closedAt,
      (open as Record<string, unknown>).id
    )
    .run();

  return { ...(open as Record<string, unknown>), status: 'CLOSED', closed_at: closedAt };
}

export async function resetDailyRisk(env: Env) {
  const today = new Date().toISOString().slice(0, 10);

  await env.DB.prepare(
    `DELETE FROM daily_risk WHERE date = ?`
  )
    .bind(today)
    .run();

  await env.DB.prepare(
    `INSERT INTO daily_risk (
      id,
      date,
      asset,
      mode,
      realized_loss_usd,
      realized_gain_usd,
      trades_count,
      max_daily_loss_hit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      today,
      'ETH-USD',
      'paper',
      0,
      0,
      0,
      0
    )
    .run();

  return { ok: true, date: today };
}

export async function writeLog(
  env: Env,
  level: string,
  area: string,
  message: string,
  data?: unknown
) {
  await env.DB.prepare(
    'INSERT INTO app_logs (id, level, area, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(
      crypto.randomUUID(),
      level,
      area,
      message,
      data ? JSON.stringify(data) : null,
      new Date().toISOString()
    )
    .run();
}
