// src/api/apiClient.ts
// Centralized API client for the Financial Literacy frontend.
// It automatically includes the base URL and Authorization header (if token exists).

const API_BASE = 'http://localhost:3005';

/**
 * Helper to perform fetch with JSON handling and auth.
 * @param path API route path, e.g. '/profiles'
 * @param options fetch options (method, body, etc.)
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Log for debugging – can be removed later.
  console.log('API request', { path, options, token, status: response.status });

  const data = await response.json();
  return data;
}
