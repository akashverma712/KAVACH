const TOKEN_KEY = 'kavach-admin-token';
const BASE = import.meta.env.VITE_API_URL || '';

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

async function raw(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  try {
    return await fetch(`${BASE}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Could not reach the Kavach server. Is the backend running?', 0, 'NETWORK');
  }
}

async function fail(res, auth) {
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  const e = data?.error || {};
  if (res.status === 401 && auth && tokenStore.get()) onUnauthorized(e.message);
  const err = new ApiError(e.message || `Request failed (${res.status})`, res.status, e.code, e.details);
  err.retryAfter = e.retryAfter ?? e.details?.retryAfter;
  return err;
}

export async function api(path, opts = {}) {
  const res = await raw(path, opts);
  if (!res.ok) throw await fail(res, opts.auth !== false);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Fetch a protected file (fundraiser proof) and return an object URL. */
export async function apiBlobUrl(path) {
  const res = await raw(path);
  if (!res.ok) throw await fail(res, true);
  return URL.createObjectURL(await res.blob());
}
