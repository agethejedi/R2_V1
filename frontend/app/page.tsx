'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

export default function DashboardPage() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await apiFetch('/bot/status');
        if (active) setStatus(next);
      } catch {
        if (active) setStatus(null);
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <h1>Bot Home</h1>
      {status ? (
        <>
          <div className="grid">
            <div className="card"><strong>State</strong><div>{status.state}</div></div>
            <div className="card"><strong>Asset</strong><div>{status.active_asset}</div></div>
            <div className="card"><strong>Mode</strong><div>{status.trading_mode}</div></div>
            <div className="card"><strong>Regime</strong><div>{status.regime || '—'}</div><small>{status.regime_confidence || '—'}</small></div>
            <div className="card"><strong>Signal Score</strong><div>{status.signal_score ?? '—'}</div></div>
            <div className="card"><strong>Entry Eligible</strong><div>{String(status.entry_eligible)}</div></div>
            <div className="card"><strong>Price</strong><div>{fmt(status.price, 6)}</div></div>
            <div className="card"><strong>VWAP</strong><div>{fmt(status.vwap, 6)}</div></div>
            <div className="card"><strong>EMA20 / EMA50</strong><div>{fmt(status.ema20, 6)} / {fmt(status.ema50, 6)}</div></div>
            <div className="card"><strong>Spread bps</strong><div>{fmt(status.spread_bps, 2)}</div></div>
            <div className="card"><strong>Fast RS</strong><div>{fmt(status.relative_strength_fast, 4)}</div></div>
            <div className="card"><strong>uPnL</strong><div>{status.unrealized_pnl ?? '—'}</div></div>
          </div>

          <div className="card">
            <h2>Regime Posture</h2>
            <p>{status.regime_posture || '—'}</p>
          </div>
          <div className="card">
            <h2>Market Commentary</h2>
            <p>{status.market_summary || '—'}</p>
          </div>
          <div className="card">
            <h2>Bot Posture</h2>
            <p>{status.bot_posture || '—'}</p>
          </div>
          <div className="card">
            <h2>Latest Decision</h2>
            <p>{status.decision_summary || status.last_message || '—'}</p>
          </div>
          <div className="card">
            <h2>Position Commentary</h2>
            <p>{status.position_summary || '—'}</p>
          </div>
          <div className="card">
            <h2>Risk Summary</h2>
            <p>{status.risk_summary || '—'}</p>
          </div>
        </>
      ) : <div className="card">Login first to load dashboard.</div>}
    </div>
  );
}
