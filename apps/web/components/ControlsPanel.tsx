'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Settings = {
  id?: string;
  active_asset: 'ETH-USD' | 'IOTX-USD';
  mode: 'paper' | 'live' | 'paused';
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  live_switch_enabled: number;
  kill_switch_enabled: number;
  max_trade_amount_usd: number;
  max_loss_per_trade_usd: number;
  desired_profit_per_trade_usd: number;
  max_daily_loss_usd: number;
  trade_amount_mode: 'manual' | 'bot';
  profit_target_mode: 'manual' | 'bot';
  updated_at?: string;
};

type ActionState = {
  loading: boolean;
  message: string;
  error: string;
};

const defaultActionState: ActionState = {
  loading: false,
  message: '',
  error: ''
};

export function ControlsPanel({
  token,
  onRefresh
}: {
  token: string;
  onRefresh?: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [manualTradeUsd, setManualTradeUsd] = useState(25);

  const [saveState, setSaveState] = useState<ActionState>(defaultActionState);
  const [tickState, setTickState] = useState<ActionState>(defaultActionState);
  const [closeState, setCloseState] = useState<ActionState>(defaultActionState);
  const [resetState, setResetState] = useState<ActionState>(defaultActionState);
  const [buyState, setBuyState] = useState<ActionState>(defaultActionState);
  const [sellState, setSellState] = useState<ActionState>(defaultActionState);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const data = await apiFetch('/api/settings', token);
      setSettings(data);
      if (typeof data?.max_trade_amount_usd === 'number') {
        setManualTradeUsd(data.max_trade_amount_usd);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoadingSettings(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, [token]);

  function updateField<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: value
    });
  }

  async function saveSettings() {
    if (!settings) return;

    setSaveState({ loading: true, message: '', error: '' });

    try {
      const payload = {
        active_asset: settings.active_asset,
        mode: settings.mode,
        aggressiveness: settings.aggressiveness,
        live_switch_enabled: settings.live_switch_enabled,
        kill_switch_enabled: settings.kill_switch_enabled,
        max_trade_amount_usd: settings.max_trade_amount_usd,
        max_loss_per_trade_usd: settings.max_loss_per_trade_usd,
        desired_profit_per_trade_usd: settings.desired_profit_per_trade_usd,
        max_daily_loss_usd: settings.max_daily_loss_usd,
        trade_amount_mode: settings.trade_amount_mode,
        profit_target_mode: settings.profit_target_mode
      };

      const updated = await apiFetch('/api/settings', token, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      setSettings(updated);
      setSaveState({
        loading: false,
        message: 'Settings saved successfully.',
        error: ''
      });
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setSaveState({
        loading: false,
        message: '',
        error: 'Failed to save settings.'
      });
    }
  }

  async function runTick() {
    setTickState({ loading: true, message: '', error: '' });

    try {
      await apiFetch('/api/tick', token, {
        method: 'POST'
      });

      setTickState({
        loading: false,
        message: 'Tick executed.',
        error: ''
      });
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setTickState({
        loading: false,
        message: '',
        error: 'Failed to run tick.'
      });
    }
  }

  async function closePosition() {
    setCloseState({ loading: true, message: '', error: '' });

    try {
      await apiFetch('/api/close-position', token, {
        method: 'POST'
      });

      setCloseState({
        loading: false,
        message: 'Close position request sent.',
        error: ''
      });
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setCloseState({
        loading: false,
        message: '',
        error: 'Failed to close position.'
      });
    }
  }

  async function resetRisk() {
    setResetState({ loading: true, message: '', error: '' });

    try {
      await apiFetch('/api/reset-risk', token, {
        method: 'POST'
      });

      setResetState({
        loading: false,
        message: 'Daily risk reset.',
        error: ''
      });
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setResetState({
        loading: false,
        message: '',
        error: 'Failed to reset daily risk.'
      });
    }
  }

  async function submitTrade(side: 'BUY' | 'SELL') {
    const usd = Number(manualTradeUsd);

    if (!usd || usd <= 0) {
      const setter = side === 'BUY' ? setBuyState : setSellState;
      setter({
        loading: false,
        message: '',
        error: 'Manual trade amount must be greater than zero.'
      });
      return;
    }

    const setter = side === 'BUY' ? setBuyState : setSellState;
    setter({ loading: true, message: '', error: '' });

    try {
      await apiFetch('/api/trade', token, {
        method: 'POST',
        body: JSON.stringify({
          side,
          notionalUsd: usd
        })
      });

      setter({
        loading: false,
        message: `${side} order submitted.`,
        error: ''
      });
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setter({
        loading: false,
        message: '',
        error: `Failed to submit ${side} order.`
      });
    }
  }

  if (loadingSettings) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Control Panel</h2>
        <p>Loading settings…</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Control Panel</h2>
        <p>Unable to load settings.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h2>Control Panel</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 16
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Asset</span>
          <select
            value={settings.active_asset}
            onChange={(e) =>
              updateField('active_asset', e.target.value as Settings['active_asset'])
            }
          >
            <option value="ETH-USD">ETH-USD</option>
            <option value="IOTX-USD">IOTX-USD</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Mode</span>
          <select
            value={settings.mode}
            onChange={(e) =>
              updateField('mode', e.target.value as Settings['mode'])
            }
          >
            <option value="paper">paper</option>
            <option value="live">live</option>
            <option value="paused">paused</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Aggressiveness</span>
          <select
            value={settings.aggressiveness}
            onChange={(e) =>
              updateField(
                'aggressiveness',
                e.target.value as Settings['aggressiveness']
              )
            }
          >
            <option value="conservative">conservative</option>
            <option value="balanced">balanced</option>
            <option value="aggressive">aggressive</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Max Trade Amount (USD)</span>
          <input
            type="number"
            value={settings.max_trade_amount_usd}
            onChange={(e) =>
              updateField('max_trade_amount_usd', Number(e.target.value))
            }
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Max Loss Per Trade (USD)</span>
          <input
            type="number"
            value={settings.max_loss_per_trade_usd}
            onChange={(e) =>
              updateField('max_loss_per_trade_usd', Number(e.target.value))
            }
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Desired Profit Per Trade (USD)</span>
          <input
            type="number"
            value={settings.desired_profit_per_trade_usd}
            onChange={(e) =>
              updateField('desired_profit_per_trade_usd', Number(e.target.value))
            }
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Max Daily Loss (USD)</span>
          <input
            type="number"
            value={settings.max_daily_loss_usd}
            onChange={(e) =>
              updateField('max_daily_loss_usd', Number(e.target.value))
            }
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Trade Amount Mode</span>
          <select
            value={settings.trade_amount_mode}
            onChange={(e) =>
              updateField(
                'trade_amount_mode',
                e.target.value as Settings['trade_amount_mode']
              )
            }
          >
            <option value="manual">manual</option>
            <option value="bot">bot</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Profit Target Mode</span>
          <select
            value={settings.profit_target_mode}
            onChange={(e) =>
              updateField(
                'profit_target_mode',
                e.target.value as Settings['profit_target_mode']
              )
            }
          >
            <option value="manual">manual</option>
            <option value="bot">bot</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Manual Trade Amount (USD)</span>
          <input
            type="number"
            value={manualTradeUsd}
            onChange={(e) => setManualTradeUsd(Number(e.target.value))}
          />
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          marginTop: 20
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!settings.live_switch_enabled}
            onChange={(e) =>
              updateField('live_switch_enabled', e.target.checked ? 1 : 0)
            }
          />
          <span>Live Switch Enabled</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!settings.kill_switch_enabled}
            onChange={(e) =>
              updateField('kill_switch_enabled', e.target.checked ? 1 : 0)
            }
          />
          <span>Kill Switch Enabled</span>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 24
        }}
      >
        <button onClick={saveSettings} disabled={saveState.loading}>
          {saveState.loading ? 'Saving…' : 'Save Settings'}
        </button>

        <button onClick={runTick} disabled={tickState.loading}>
          {tickState.loading ? 'Running…' : 'Run Tick'}
        </button>

        <button onClick={() => submitTrade('BUY')} disabled={buyState.loading}>
          {buyState.loading ? 'Buying…' : 'Buy'}
        </button>

        <button onClick={() => submitTrade('SELL')} disabled={sellState.loading}>
          {sellState.loading ? 'Selling…' : 'Sell'}
        </button>

        <button onClick={closePosition} disabled={closeState.loading}>
          {closeState.loading ? 'Closing…' : 'Close Position'}
        </button>

        <button onClick={resetRisk} disabled={resetState.loading}>
          {resetState.loading ? 'Resetting…' : 'Reset Daily Risk'}
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 6 }}>
        {saveState.message ? <p style={{ color: '#16a34a' }}>{saveState.message}</p> : null}
        {saveState.error ? <p style={{ color: '#dc2626' }}>{saveState.error}</p> : null}

        {tickState.message ? <p style={{ color: '#16a34a' }}>{tickState.message}</p> : null}
        {tickState.error ? <p style={{ color: '#dc2626' }}>{tickState.error}</p> : null}

        {buyState.message ? <p style={{ color: '#16a34a' }}>{buyState.message}</p> : null}
        {buyState.error ? <p style={{ color: '#dc2626' }}>{buyState.error}</p> : null}

        {sellState.message ? <p style={{ color: '#16a34a' }}>{sellState.message}</p> : null}
        {sellState.error ? <p style={{ color: '#dc2626' }}>{sellState.error}</p> : null}

        {closeState.message ? <p style={{ color: '#16a34a' }}>{closeState.message}</p> : null}
        {closeState.error ? <p style={{ color: '#dc2626' }}>{closeState.error}</p> : null}

        {resetState.message ? <p style={{ color: '#16a34a' }}>{resetState.message}</p> : null}
        {resetState.error ? <p style={{ color: '#dc2626' }}>{resetState.error}</p> : null}
      </div>
    </div>
  );
}