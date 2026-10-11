import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { validate } from '../../middleware/validate.js';
import { audit, notify } from '../../services/activity.service.js';
import { ah, notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/paginate.js';
import { uuid } from '../schemas.js';

const router = Router();
const idParam = validate(z.object({ id: uuid }), 'params');

router.get('/', ah(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { defaultLimit: 25, maxLimit: 100 });
  const params = [];
  const where = [];
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.regd_no ILIKE $${params.length})`);
  }
  if (['active', 'suspended', 'banned'].includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`u.status = $${params.length}`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(
      `SELECT u.id, u.name, u.email, u.phone, u.branch, u.batch, u.regd_no, u.status, u.suspended_until, u.moderation_reason,
              u.college_record_id IS NOT NULL AS college_verified, u.last_login_at, u.created_at,
              (SELECT count(*)::int FROM posts p WHERE p.user_id = u.id) AS post_count,
              (SELECT count(*)::int FROM reports r JOIN posts p ON p.id = r.post_id WHERE p.user_id = u.id) AS reports_against,
              (SELECT count(*)::int FROM sos_events s WHERE s.user_id = u.id) AS sos_count
         FROM users u ${w}
        ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    query(`SELECT count(*)::int AS total FROM users u ${w}`, params),
  ]);
  res.json({ items: rows, total, page, limit });
}));

const reasonSchema = z.string().trim().min(3, 'Give a short reason').max(300);

router.post('/:id/suspend', idParam, validate(z.object({
  days: z.coerce.number().int().min(1).max(365),
  reason: reasonSchema,
}).strict()), ah(async (req, res) => {
  const { rows: [u] } = await query(
    `UPDATE users SET status = 'suspended', suspended_until = now() + make_interval(days => $2), moderation_reason = $3,
            token_version = token_version + 1, updated_at = now()
      WHERE id = $1 RETURNING id, status, suspended_until`,
    [req.params.id, req.body.days, req.body.reason],
  );
  if (!u) throw notFound('User not found');
  await audit(req, 'user.suspend', u.id, req.body);
  res.json({ user: u });
}));

router.post('/:id/ban', idParam, validate(z.object({ reason: reasonSchema }).strict()), ah(async (req, res) => {
  const { rows: [u] } = await query(
    `UPDATE users SET status = 'banned', suspended_until = NULL, moderation_reason = $2,
            token_version = token_version + 1, updated_at = now()
      WHERE id = $1 RETURNING id, status`,
    [req.params.id, req.body.reason],
  );
  if (!u) throw notFound('User not found');
  await audit(req, 'user.ban', u.id, req.body);
  res.json({ user: u });
}));

router.post('/:id/reinstate', idParam, ah(async (req, res) => {
  const { rows: [u] } = await query(
    `UPDATE users SET status = 'active', suspended_until = NULL, moderation_reason = NULL, updated_at = now()
      WHERE id = $1 RETURNING id, status`,
    [req.params.id],
  );
  if (!u) throw notFound('User not found');
  await notify(u.id, { title: 'Your account is active again', body: 'Welcome back. Please keep posts respectful and genuine.' });
  await audit(req, 'user.reinstate', u.id);
  res.json({ user: u });
}));

export default router;
