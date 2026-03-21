'use client';

function fmt(n: any, decimals = 2) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(decimals);
}

<Card title="Recent Positions" className="span-6">
  <table className="table">
    <thead>
      <tr>
        <th>Asset</th>
        <th>Status</th>
        <th>Entry</th>
        <th>Last</th>
        <th>Qty</th>
        <th>Unrealized</th>
        <th>Realized</th>
        <th>% Return</th>
      </tr>
    </thead>
    <tbody>
      {positions.length ? (
        positions.map((p) => {
          const returnPct = calcReturnPct(p);

          return (
            <tr key={p.id}>
              <td>{p.asset}</td>
              <td>{p.status}</td>
              <td>{fmt(p.avg_entry_price, 2)}</td>
              <td>{fmt(p.last_price, 5)}</td>
              <td>{fmt(p.quantity, 6)}</td>
              <td style={{ color: pnlColor(p.unrealized_pnl) }}>
                {fmt(p.unrealized_pnl, 2)}
              </td>
              <td style={{ color: pnlColor(p.realized_pnl) }}>
                {fmt(p.realized_pnl, 2)}
              </td>
              <td style={{ color: pnlColor(returnPct) }}>
                {fmt(returnPct, 2)}%
              </td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td colSpan={8}>No positions yet.</td>
        </tr>
      )}
    </tbody>
  </table>
</Card>

import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ControlsPanel } from '../components/ControlsPanel';
import { apiFetch } from '../lib/api';

export default function HomePage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [form, setForm] = useState({ username: 'admin', password: '' });
  const [loginError, setLoginError] = useState('');

  async function login() {
    setLoginError('');

    try {
      const res = await apiFetch('/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify(form)
      });

      setToken(res.token);
      localStorage.setItem('bot_token', res.token);
    } catch (err) {
      console.error(err);
      setLoginError('Login failed. Please check your username and password.');
    }
  }

  async function loadDashboard(currentToken: string) {
    try {
      const [s, o, p, d] = await Promise.all([
        apiFetch('/api/status', currentToken),
        apiFetch('/api/orders', currentToken),
        apiFetch('/api/positions', currentToken),
        apiFetch('/api/decisions', currentToken)
      ]);

      setStatus(s);
      setOrders(o);
      setPositions(p);
      setDecisions(d);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  }

  useEffect(() => {
    const t = localStorage.getItem('bot_token');
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;

    loadDashboard(token);

    const id = setInterval(() => {
      loadDashboard(token);
    }, 15000);

    return () => clearInterval(id);
  }, [token]);

  if (!token) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 420, margin: '80px auto' }}>
          <h2>Bot Login</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />
            <button onClick={login}>Sign in</button>
            {loginError ? (
              <p style={{ color: '#dc2626', margin: 0 }}>{loginError}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>IOTX / ETH Coinbase Bot</h1>

      <ControlsPanel token={token} />

      <div className="grid">
        <Card title="Current Regime" className="span-4">
          <div className="badge">{status?.regime || 'Unknown'}</div>
          <div className="metric">
            {Math.round((status?.regimeConfidence || 0) * 100)}%
          </div>
          <div className="small">Confidence</div>
        </Card>

        <Card title="Bot Status" className="span-4">
          <div className="badge">{status?.mode || 'paper'}</div>
          <div className="metric">{status?.asset || 'ETH-USD'}</div>
          <div className="small">Last price: {status?.lastPrice ?? '—'}</div>
        </Card>

        <Card title="Entry Eligibility" className="span-4">
          <div className="badge">
            {status?.entryEligible ? 'Eligible' : 'Waiting'}
          </div>
          <div className="metric">
            {status?.signalScore?.toFixed?.(1) || '0.0'}
          </div>
          <div className="small">Signal score</div>
        </Card>

        <Card title="Market Commentary" className="span-6">
          <p>{status?.commentary?.market || 'No commentary yet.'}</p>
          <p className="small">{status?.commentary?.posture}</p>
        </Card>

        <Card title="Decision Commentary" className="span-6">
          <p>{status?.commentary?.decision || 'No decision commentary yet.'}</p>
          <p className="small">{status?.commentary?.risk}</p>
        </Card>

        <Card title="Recent Positions" className="span-6">
  <table className="table">
    <thead>
      <tr>
        <th>Asset</th>
        <th>Status</th>
        <th>Entry</th>
        <th>Last</th>
        <th>Qty</th>
        <th>Unrealized</th>
        <th>Realized</th>
        <th>% Return</th>
      </tr>
    </thead>
    <tbody>
      {positions.length ? (
        positions.map((p) => {
          const returnPct = calcReturnPct(p);

          return (
            <tr key={p.id}>
              <td>{p.asset}</td>
              <td>{p.status}</td>
              <td>{fmt(p.avg_entry_price, 2)}</td>
              <td>{fmt(p.last_price, 5)}</td>
              <td>{fmt(p.quantity, 6)}</td>
              <td style={{ color: pnlColor(p.unrealized_pnl) }}>
                {fmt(p.unrealized_pnl, 2)}
              </td>
              <td style={{ color: pnlColor(p.realized_pnl) }}>
                {fmt(p.realized_pnl, 2)}
              </td>
              <td style={{ color: pnlColor(returnPct) }}>
                {fmt(returnPct, 2)}%
              </td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td colSpan={8}>No positions yet.</td>
        </tr>
      )}
    </tbody>
  </table>
</Card>        <Card title="Recent Orders" className="span-6">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Side</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length ? (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.asset}</td>
                    <td>{o.side}</td>
                    <td>{o.mode}</td>
                    <td>{o.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Recent Decisions">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Allowed</th>
                <th>Reason</th>
                <th>Score</th>
                <th>Regime</th>
              </tr>
            </thead>
            <tbody>
              {decisions.length ? (
                decisions.map((d) => (
                  <tr key={d.id}>
                    <td>{d.created_at}</td>
                    <td>{d.allowed ? 'Yes' : 'No'}</td>
                    <td>{d.reason}</td>
                    <td>{d.score}</td>
                    <td>{d.regime}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No decisions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
