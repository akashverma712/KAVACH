import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { ah, forbidden, unauthorized } from '../utils/errors.js';

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
};

export function signUserToken(user) {
  return jwt.sign({ sub: user.id, tv: user.token_version }, env.jwtSecret, {
    algorithm: 'HS256', expiresIn: env.jwtExpiresIn, issuer: 'kavach', audience: 'student',
  });
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, role: 'admin' }, env.adminJwtSecret, {
    algorithm: 'HS256', expiresIn: env.adminJwtExpiresIn, issuer: 'kavach', audience: 'admin',
  });
}

export function moderationError(user) {
  if (user.status === 'banned') {
    return forbidden(`Your account has been banned${user.moderation_reason ? `: ${user.moderation_reason}` : '.'} Contact the campus admin if you think this is a mistake.`, 'ACCOUNT_BANNED');
  }
  if (user.status === 'suspended' && user.suspended_until && new Date(user.suspended_until) > new Date()) {
    const until = new Date(user.suspended_until).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    return forbidden(`Your account is suspended until ${until}${user.moderation_reason ? ` (${user.moderation_reason})` : ''}.`, 'ACCOUNT_SUSPENDED');
  }
  return null;
}

/** Lift a suspension whose end date has passed. Returns the (possibly updated) user. */
export async function liftExpiredSuspension(user) {
  if (user.status === 'suspended' && user.suspended_until && new Date(user.suspended_until) <= new Date()) {
    await query(`UPDATE users SET status = 'active', suspended_until = NULL, moderation_reason = NULL WHERE id = $1`, [user.id]);
    return { ...user, status: 'active', suspended_until: null, moderation_reason: null };
  }
  return user;
}

export const requireUser = ah(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'kavach', audience: 'student' });
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  const { rows } = await query(
    `SELECT id, college_record_id, name, email, phone, branch, batch, regd_no, status, suspended_until,
            moderation_reason, token_version, created_at
       FROM users WHERE id = $1`,
    [payload.sub],
  );
  let user = rows[0];
  if (!user || user.token_version !== payload.tv) throw unauthorized('Your session has ended. Please sign in again.', 'TOKEN_REVOKED');
  user = await liftExpiredSuspension(user);
  const blocked = moderationError(user);
  if (blocked) throw blocked;
  req.user = user;
  next();
});

export const requireAdmin = ah(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw unauthorized('Admin sign-in required');
  let payload;
  try {
    payload = jwt.verify(token, env.adminJwtSecret, { algorithms: ['HS256'], issuer: 'kavach', audience: 'admin' });
  } catch {
    throw unauthorized('Your admin session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  const { rows } = await query('SELECT id, name, email, phone FROM admins WHERE id = $1', [payload.sub]);
  if (!rows[0]) throw unauthorized('Admin account not found', 'TOKEN_REVOKED');
  req.admin = rows[0];
  next();
});
