'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    apiFetch('/orders').then(setOrders).catch(() => null);
    apiFetch('/orders/positions').then(setPositions).catch(() => null);
  }

  useEffect(() => { load(); }, []);

  async function closePosition(asset: string, mode: string) {
    setMessage('');
    await apiFetch(`/orders/close-position?asset=${encodeURIComponent(asset)}&mode=${encodeURIComponent(mode)}`, { method: 'POST' });
    setMessage(`Close submitted for ${asset} (${mode})`);
    await load();
  }

  return (
    <div>
      <h1>Orders</h1>
      {message && <p className="success">{message}</p>}
      <div className="card">
        <h3>Open Positions</h3>
        <table>
          <thead>
            <tr><th>Asset</th><th>Mode</th><th>Qty</th><th>Avg Entry</th><th>uPnL</th><th>Stop</th><th>Target</th><th></th></tr>
          </thead>
          <tbody>
            {positions.filter((p) => p.quantity > 0).map((p) => (
              <tr key={p.id}>
                <td>{p.asset}</td>
                <td>{p.mode}</td>
                <td>{p.quantity}</td>
                <td>{p.average_entry_price}</td>
                <td>{p.unrealized_pnl}</td>
                <td>{p.stop_loss_price ?? '—'}</td>
                <td>{p.target_price ?? '—'}</td>
                <td><button onClick={() => closePosition(p.asset, p.mode)}>Close</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Time</th><th>Asset</th><th>Mode</th><th>Side</th><th>Status</th><th>Qty</th><th>Fill Price</th><th>Fees</th><th>Exit</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.created_at}</td>
                <td>{o.asset}</td>
                <td>{o.mode}</td>
                <td>{o.side}</td>
                <td>{o.status}</td>
                <td>{o.filled_quantity}</td>
                <td>{o.average_fill_price}</td>
                <td>{o.fee_usd}</td>
                <td>{o.exit_reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
