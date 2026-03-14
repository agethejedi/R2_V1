const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function apiFetch(path: string, token?: string, options?: RequestInit) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    }
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }

  return res.json();
}
