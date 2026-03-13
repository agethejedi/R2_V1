'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function LogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    apiFetch('/logs/signals').then(setRows).catch(() => null);
  }, []);
  return (
    <div>
      <h1>Signal Logs</h1>
      <div className="card">
        <table>
          <thead>
            <tr><th>Time</th><th>Asset</th><th>Preset</th><th>Setup</th><th>Rec</th><th>Score</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at}</td>
                <td>{r.asset}</td>
                <td>{r.aggressiveness}</td>
                <td>{r.setup_type}</td>
                <td>{r.recommendation}</td>
                <td>{r.composite_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
