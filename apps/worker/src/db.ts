import { Env } from './types';

export async function ensureDefaultSettings(env: Env) {
  const row = await env.DB.prepare('SELECT id FROM settings LIMIT 1').first();
  if (!row) {
    await env.DB.prepare(`INSERT INTO settings (
      id, active_asset, mode, aggressiveness, live_switch_enabled, kill_switch_enabled,
      max_trade_amount_usd, max_loss_per_trade_usd, desired_profit_per_trade_usd,
      max_daily_loss_usd, trade_amount_mode, profit_target_mode, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
      ).run();
  }
}

export async function getSettings(env: Env) {
  await ensureDefaultSettings(env);
  return env.DB.prepare('SELECT * FROM settings LIMIT 1').first();
}

export async function getOrders(env: Env, limit = 50) {
  const result = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return result.results;
}

export async function getPositions(env: Env) {
  const result = await env.DB.prepare("SELECT * FROM positions ORDER BY opened_at DESC LIMIT 10").all();
  return result.results;
}

export async function getDecisions(env: Env, limit = 20) {
  const result = await env.DB.prepare('SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return result.results;
}

export async function writeLog(env: Env, level: string, area: string, message: string, data?: unknown) {
  await env.DB.prepare('INSERT INTO app_logs (id, level, area, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), level, area, message, data ? JSON.stringify(data) : null, new Date().toISOString())
    .run();
}
