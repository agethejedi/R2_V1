'use client';
import Link from 'next/link';

export function Nav() {
  return (
    <nav>
      <Link href="/">Dashboard</Link>
      <Link href="/controls">Controls</Link>
      <Link href="/orders">Orders</Link>
      <Link href="/pnl">P&L</Link>
      <Link href="/logs">Logs</Link>
      <Link href="/login">Login</Link>
    </nav>
  );
}
