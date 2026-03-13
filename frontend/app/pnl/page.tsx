'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function PnlPage() {
  const [summary, setSummary] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [exitReasons, setExitReasons] = useState<any>(null);

  useEffect(() => {
    apiFetch('/reports/pnl').then(setSummary).catch(() => null);
    apiFetch('/reports/comparison').then(setComparison).catch(() => null);
    apiFetch('/reports/exit-reasons').then(setExitReasons).catch(() => null);
  }, []);

  return (
    <div>
      <h1>P&amp;L</h1>
      <div className="card"><pre>{JSON.stringify(summary, null, 2)}</pre></div>
      <div className="card"><h2>Paper vs Live</h2><pre>{JSON.stringify(comparison, null, 2)}</pre></div>
      <div className="card"><h2>Exit Reasons</h2><pre>{JSON.stringify(exitReasons, null, 2)}</pre></div>
    </div>
  );
}
