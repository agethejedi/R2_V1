export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
