import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { normalizeEmail, normalizePhone } from '../utils/phone.js';

/**
 * Atomically increment a fixed-window counter stored in PostgreSQL.
 * Because the counters live in the database, limits are enforced consistently
 * across any number of API instances (horizontal scaling).
 */
export async function hit(key, windowMs) {
  const { rows } = await query(
    `INSERT INTO rate_limits (key, hits, reset_at)
     VALUES ($1, 1, now() + make_interval(secs => $2::double precision / 1000))
     ON CONFLICT (key) DO UPDATE SET
       hits     = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= now()
                       THEN now() + make_interval(secs => $2::double precision / 1000)
                       ELSE rate_limits.reset_at END
     RETURNING hits, reset_at`,
    [key, windowMs],
  );
  return { totalHits: rows[0].hits, resetTime: rows[0].reset_at };
}

/** express-rate-limit store backed by PostgreSQL. */
export class PgStore {
  constructor(name) {
    this.prefix = `rl:${name}:`;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async get(key) {
    const { rows } = await query('SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > now()', [this.prefix + key]);
    return rows[0] ? { totalHits: rows[0].hits, resetTime: rows[0].reset_at } : undefined;
  }

  async increment(key) {
    return hit(this.prefix + key, this.windowMs);
  }

  async decrement(key) {
    await query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [this.prefix + key]);
  }

  async resetKey(key) {
    await query('DELETE FROM rate_limits WHERE key = $1', [this.prefix + key]);
  }
}

function limiter(name, { windowMs, limit, keyGenerator, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new PgStore(name),
    keyGenerator,
    skipSuccessfulRequests,
    handler: (req, res) => {
      const reset = req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime) : null;
      const retryAfter = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: { code: 'RATE_LIMITED', message, retryAfter } });
    },
  });
}

const MIN = 60_000;
const ip = (req) => req.ip || req.socket?.remoteAddress || 'unknown';
const userKey = (req) => (req.user ? `u:${req.user.id}` : `ip:${ip(req)}`);
const adminKey = (req) => (req.admin ? `a:${req.admin.id}` : `ip:${ip(req)}`);

/** Identifier from the request body (email / phone / name), independent of IP address. */
function identifierKey(req) {
  const b = req.body || {};
  const raw = b.identifier ?? b.email ?? b.phone ?? '';
  const id = normalizeEmail(raw) || normalizePhone(raw) || String(raw).trim().toLowerCase().slice(0, 120);
  return id ? `id:${id}` : `ip:${ip(req)}`;
}

// Same IP: overall API ceiling per address
export const globalLimiter = limiter('global', {
  windowMs: 15 * MIN, limit: 600,
  message: 'Too many requests from this network. Please slow down and try again shortly.',
});

// Same IP: auth endpoints
export const authIpLimiter = limiter('auth-ip', {
  windowMs: 15 * MIN, limit: 30,
  message: 'Too many sign-in attempts from this network. Try again in a few minutes.',
});

// Different IPs: the same account/identifier attacked from many addresses
export const authIdentifierLimiter = limiter('auth-id', {
  windowMs: 15 * MIN, limit: 10,
  keyGenerator: identifierKey,
  message: 'Too many attempts for this account. Try again in 15 minutes.',
});

// OTP verification attempts per IP
export const otpVerifyLimiter = limiter('otp-verify', {
  windowMs: 15 * MIN, limit: 40,
  message: 'Too many verification attempts. Try again in a few minutes.',
});

export const sosIpLimiter = limiter('sos-ip', {
  windowMs: 60 * MIN, limit: 40,
  message: 'Too many SOS requests from this network.',
});

export const writeLimiter = limiter('write', {
  windowMs: 15 * MIN, limit: 60, keyGenerator: userKey,
  message: 'You are doing that too often. Take a short break and try again.',
});

export const postCreateLimiter = limiter('post-create', {
  windowMs: 60 * MIN, limit: 10, keyGenerator: userKey,
  message: 'You can post up to 10 problems per hour.',
});

export const fundraiserCreateLimiter = limiter('fund-create', {
  windowMs: 24 * 60 * MIN, limit: 3, keyGenerator: userKey,
  message: 'You can start up to 3 fundraisers per day.',
});

export const chatLimiter = limiter('chat', {
  windowMs: MIN, limit: 20, keyGenerator: userKey,
  message: 'You are sending messages too quickly. Wait a moment.',
});

export const adminWriteLimiter = limiter('admin-write', {
  windowMs: 15 * MIN, limit: 500, keyGenerator: adminKey,
  message: 'Too many admin actions in a short time. Wait a moment.',
});

export const importLimiter = limiter('import', {
  windowMs: 15 * MIN, limit: 20, keyGenerator: adminKey,
  message: 'Too many imports. Wait a few minutes.',
});

/** Remove expired counters periodically. */
export function startRateLimitJanitor() {
  const t = setInterval(() => {
    query('DELETE FROM rate_limits WHERE reset_at < now()').catch(() => {});
  }, 10 * MIN);
  t.unref();
}
