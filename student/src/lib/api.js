const TOKEN_KEY = 'kavach-token';
const BASE = import.meta.env.VITE_API_URL || '';
export const API_BASE = BASE;

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/**
 * Small fetch wrapper.
 *  api('/posts')                               GET
 *  api('/posts', { method: 'POST', body })     JSON
 *  api('/posts', { method: 'POST', form })     multipart (FormData)
 */
export async function api(path, { method = 'GET', body, form, auth = true, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(navigator.onLine ? 'Could not reach the server. Check your connection and try again.' : 'You are offline. Connect to the internet and try again.', 0, 'NETWORK');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && auth && token) onUnauthorized(e.message);
    const err = new ApiError(e.message || `Request failed (${res.status})`, res.status, e.code, e.details);
    err.retryAfter = e.retryAfter ?? e.details?.retryAfter;
    err.extra = e.details;
    throw err;
  }
  return data;
}

/** Clear cached API responses (used on sign-out so the next user never sees them offline). */
export async function clearApiCache() {
  try {
    if ('caches' in window) await caches.delete('kavach-api');
  } catch { /* ignore */ }
}
