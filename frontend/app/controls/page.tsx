'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function ControlsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    apiFetch('/bot/settings').then(setSettings).catch(() => null);
  }, []);

  async function save() {
    setMessage('');
    const updated = await apiFetch('/bot/settings', { method: 'PUT', body: JSON.stringify(settings) });
    setSettings(updated);
    setMessage('Saved');
  }

  async function start() {
    await apiFetch('/bot/start', { method: 'POST' });
    setMessage('Bot started');
  }

  async function stop() {
    await apiFetch('/bot/stop', { method: 'POST' });
    setMessage('Bot stopped');
  }

  if (!settings) return <div className="card">Login first to edit controls.</div>;
  return (
    <div>
      <h1>Controls</h1>
      <div className="card grid">
        <div>
          <label>Asset</label>
          <select value={settings.active_asset} onChange={(e) => setSettings({ ...settings, active_asset: e.target.value })}>
            <option>ETH-USD</option>
            <option>IOTX-USD</option>
          </select>
        </div>
        <div>
          <label>Mode</label>
          <select value={settings.trading_mode} onChange={(e) => setSettings({ ...settings, trading_mode: e.target.value })}>
            <option value="paper">paper</option>
            <option value="live">live</option>
            <option value="paused">paused</option>
          </select>
        </div>
        <div>
          <label>Aggressiveness</label>
          <select value={settings.aggressiveness} onChange={(e) => setSettings({ ...settings, aggressiveness: e.target.value })}>
            <option value="conservative">conservative</option>
            <option value="balanced">balanced</option>
            <option value="aggressive">aggressive</option>
          </select>
        </div>
        <div>
          <label>Trade Amount Mode</label>
          <select value={settings.trade_amount_mode} onChange={(e) => setSettings({ ...settings, trade_amount_mode: e.target.value })}>
            <option value="manual">manual</option>
            <option value="bot">bot</option>
          </select>
        </div>
        <div>
          <label>Profit Target Mode</label>
          <select value={settings.profit_target_mode} onChange={(e) => setSettings({ ...settings, profit_target_mode: e.target.value })}>
            <option value="manual">manual</option>
            <option value="bot">bot</option>
          </select>
        </div>
        <div>
          <label>Max Trade Amount</label>
          <input value={settings.max_trade_amount_usd} type="number" onChange={(e) => setSettings({ ...settings, max_trade_amount_usd: Number(e.target.value) })} />
        </div>
        <div>
          <label>Max Loss / Trade</label>
          <input value={settings.max_loss_per_trade_usd} type="number" onChange={(e) => setSettings({ ...settings, max_loss_per_trade_usd: Number(e.target.value) })} />
        </div>
        <div>
          <label>Desired Profit / Trade</label>
          <input value={settings.desired_profit_per_trade_usd} type="number" onChange={(e) => setSettings({ ...settings, desired_profit_per_trade_usd: Number(e.target.value) })} />
        </div>
        <div>
          <label>Max Daily Loss</label>
          <input value={settings.max_daily_loss_usd} type="number" onChange={(e) => setSettings({ ...settings, max_daily_loss_usd: Number(e.target.value) })} />
        </div>
        <div>
          <label>Min Entry Interval (sec)</label>
          <input value={settings.min_entry_interval_seconds} type="number" onChange={(e) => setSettings({ ...settings, min_entry_interval_seconds: Number(e.target.value) })} />
        </div>
      </div>
      <div className="card">
        <label><input checked={settings.live_switch_enabled} type="checkbox" onChange={(e) => setSettings({ ...settings, live_switch_enabled: e.target.checked })} /> Live Switch Enabled</label>
        <label><input checked={settings.kill_switch_enabled} type="checkbox" onChange={(e) => setSettings({ ...settings, kill_switch_enabled: e.target.checked })} /> Kill Switch</label>
        <label><input checked={settings.ema_filter_enabled} type="checkbox" onChange={(e) => setSettings({ ...settings, ema_filter_enabled: e.target.checked })} /> EMA Filter</label>
        <label><input checked={settings.relative_strength_filter_enabled} type="checkbox" onChange={(e) => setSettings({ ...settings, relative_strength_filter_enabled: e.target.checked })} /> Relative Strength Filter</label>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={save}>Save</button>
        <button onClick={start}>Start</button>
        <button onClick={stop}>Stop</button>
      </div>
      {message && <p className="success">{message}</p>}
    </div>
  );
}
