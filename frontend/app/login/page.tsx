'use client';
import { useState } from 'react';
import { API_BASE } from '../../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      setMessage('Login failed');
      return;
    }
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    setMessage('Login successful');
  }

  return (
    <div className="card">
      <h1>Login</h1>
      <form onSubmit={onSubmit}>
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <button type="submit">Sign In</button>
        </div>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
