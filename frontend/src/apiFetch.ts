const TOKEN_KEY = 'startupforge:auth-token';

export function getAuthToken() {
  try { return window.sessionStorage.getItem(TOKEN_KEY) || ''; }
  catch { return ''; }
}

export function setAuthToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* Private browsing may disable sessionStorage. */ }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  try {
    const requestUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const apiUrl = new URL(import.meta.env.VITE_API_URL || 'http://localhost:3000', window.location.href);
    const token = getAuthToken();
    if (token && requestUrl.origin === apiUrl.origin) headers.set('Authorization', `Bearer ${token}`);
  } catch { /* Leave malformed or non-HTTP requests to fetch for its normal error. */ }
  return fetch(input, { ...init, headers });
}
