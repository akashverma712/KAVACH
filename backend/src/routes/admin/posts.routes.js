import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../../db/pool.js';
import { validate } from '../../middleware/validate.js';
import { audit, notify } from '../../services/activity.service.js';
import { ah, badRequest, notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/paginate.js';
import { POST_SELECT, STATUS_LABEL } from '../posts.routes.js';
import { uuid } from '../schemas.js';

export const postsRouter = Router();
export const reportsRouter = Router();
const idParam = validate(z.object({ id: uuid }), 'params');

postsRouter.get('/', validate(z.object({
  sort: z.enum(['recent', 'oldest', 'severity', 'reports']).default('recent'),
  status: z.enum(['all', 'active', 'open', 'marked_for_solving', 'in_progress', 'under_review', 'solved', 'closed']).default('all'),
  severity: z.enum(['all', '1', '2', '3', '4']).default('all'),
  visibility: z.enum(['all', 'visible', 'hidden']).default('all'),
  q: z.string().trim().max(100).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
}), 'query'), ah(async (req, res) => {
  const f = req.validatedQuery;
  const { page, limit, offset } = paginate(f, { defaultLimit: 20, maxLimit: 100 });
  const params = [];
  const where = ['TRUE'];
  if (f.status === 'active') where.push(`p.status <> 'closed'`);
  else if (f.status !== 'all') { params.push(f.status); where.push(`p.status = $${params.length}`); }
  if (f.severity !== 'all') { params.push(Number(f.severity)); where.push(`p.severity = $${params.length}`); }
  if (f.visibility === 'hidden') where.push('p.is_hidden');
  if (f.visibility === 'visible') where.push('NOT p.is_hidden');
  if (f.q) { params.push(`%${f.q.replace(/[%_\\]/g, '\\$&')}%`); where.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
  const order = {
    recent: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    severity: 'p.severity DESC, p.created_at DESC',
    reports: 'p.report_count DESC, p.created_at DESC',
  }[f.sort];
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(
      `SELECT ${POST_SELECT(null)}, u.status AS author_status FROM posts p JOIN users u ON u.id = p.user_id
        WHERE ${where.join(' AND ')} ORDER BY ${order}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    query(`SELECT count(*)::int AS total FROM posts p JOIN users u ON u.id = p.user_id WHERE ${where.join(' AND ')}`, params),
  ]);
  res.json({ items: rows, total, page, limit });
}));

postsRouter.get('/:id', idParam, ah(async (req, res) => {
  const { rows: [post] } = await query(
    `SELECT ${POST_SELECT(null)}, u.email AS author_email, u.phone AS author_phone, u.regd_no AS author_regd_no, u.status AS author_status
       FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [req.params.id],
  );
  if (!post) throw notFound('Problem not found');
  const [{ rows: updates }, { rows: comments }, { rows: reports }] = await Promise.all([
    query('SELECT id, actor, status, note, created_at FROM post_updates WHERE post_id = $1 ORDER BY created_at', [post.id]),
    query(`SELECT c.id, c.body, c.is_deleted, c.created_at, u.name AS author_name, u.id AS author_id
             FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = $1 ORDER BY c.created_at`, [post.id]),
    query(`SELECT r.id, r.reason, r.details, r.status, r.created_at, u.name AS reporter_name
             FROM reports r JOIN users u ON u.id = r.reporter_id WHERE r.post_id = $1 ORDER BY r.created_at DESC`, [post.id]),
  ]);
  res.json({ post, updates, comments, reports });
}));

const ADMIN_STATUSES = ['open', 'marked_for_solving', 'in_progress', 'under_review', 'solved'];

postsRouter.patch('/:id/status', idParam, validate(z.object({
  status: z.enum(ADMIN_STATUSES),
  note: z.string().trim().max(500).optional(),
}).strict()), ah(async (req, res) => {
  const { status, note } = req.body;
  const result = await tx(async (c) => {
    const { rows: [p] } = await c.query('SELECT * FROM posts WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!p) throw notFound('Problem not found');
    if (p.status === 'closed') throw badRequest('This problem is closed and can no longer be updated', 'POST_CLOSED');
    const solved = status === 'solved';
    const closeNow = solved && p.student_resolved;
    await c.query(
      `UPDATE posts SET status = $2, admin_resolved = $3, updated_at = now(),
              closed_at = CASE WHEN $4::boolean THEN now() ELSE closed_at END,
              closed_by = CASE WHEN $4::boolean THEN 'mutual' ELSE closed_by END
        WHERE id = $1`,
      [p.id, closeNow ? 'closed' : status, solved, closeNow],
    );
    await c.query(`INSERT INTO post_updates (post_id, actor, admin_id, status, note) VALUES ($1, 'admin', $2, $3, $4)`,
      [p.id, req.admin.id, status, note || null]);
    return { p, finalStatus: closeNow ? 'closed' : status };
  });
  const { p } = result;
  await notify(p.user_id, status === 'solved'
    ? { title: 'Your problem was marked solved', body: `"${p.title}" — confirm it's resolved so it can be closed, or tell us it isn't.`, link: `/app/community/${p.id}` }
    : { title: `Update: ${STATUS_LABEL[status]}`, body: `"${p.title}"${note ? ` — ${note}` : ''}`, link: `/app/community/${p.id}` });
  await audit(req, 'post.status', p.id, { status, note });
  res.json({ status: result.finalStatus });
}));

postsRouter.post('/:id/hide', idParam, validate(z.object({ reason: z.string().trim().min(3).max(300) }).strict()), ah(async (req, res) => {
  const { rows: [p] } = await query('UPDATE posts SET is_hidden = true, hidden_reason = $2, updated_at = now() WHERE id = $1 RETURNING id, user_id, title', [req.params.id, req.body.reason]);
  if (!p) throw notFound('Problem not found');
  await notify(p.user_id, { title: 'Your post was hidden by the admin', body: `"${p.title}" — ${req.body.reason}`, link: `/app/community/${p.id}` });
  await audit(req, 'post.hide', p.id, req.body);
  res.json({ ok: true });
}));

postsRouter.post('/:id/unhide', idParam, ah(async (req, res) => {
  const { rows: [p] } = await query('UPDATE posts SET is_hidden = false, hidden_reason = NULL, updated_at = now() WHERE id = $1 RETURNING id', [req.params.id]);
  if (!p) throw notFound('Problem not found');
  await query(`UPDATE reports SET status = 'dismissed', reviewed_by = $2, reviewed_at = now() WHERE post_id = $1 AND status = 'pending'`, [p.id, req.admin.id]);
  await audit(req, 'post.unhide', p.id);
  res.json({ ok: true });
}));

postsRouter.delete('/:id/comments/:commentId', validate(z.object({ id: uuid, commentId: uuid }), 'params'), ah(async (req, res) => {
  const { rowCount } = await query('UPDATE comments SET is_deleted = true WHERE id = $1 AND post_id = $2', [req.params.commentId, req.params.id]);
  if (!rowCount) throw notFound('Comment not found');
  await audit(req, 'comment.remove', req.params.commentId);
  res.json({ ok: true });
}));

/* ───────────── Reports ───────────── */

reportsRouter.get('/', ah(async (req, res) => {
  const status = ['pending', 'dismissed', 'actioned'].includes(req.query.status) ? req.query.status : 'pending';
  const { rows } = await query(
    `SELECT p.id AS post_id, p.title, p.description, p.images, p.is_hidden, p.report_count, p.created_at AS post_created_at,
            a.id AS author_id, a.name AS author_name, a.status AS author_status, a.regd_no AS author_regd_no,
            json_agg(json_build_object('id', r.id, 'reason', r.reason, 'details', r.details, 'reporter', u.name, 'created_at', r.created_at)
                     ORDER BY r.created_at DESC) AS reports,
            max(r.created_at) AS last_reported_at
       FROM reports r
       JOIN posts p ON p.id = r.post_id
       JOIN users a ON a.id = p.user_id
       JOIN users u ON u.id = r.reporter_id
      WHERE r.status = $1
      GROUP BY p.id, a.id
      ORDER BY count(r.id) DESC, max(r.created_at) DESC
      LIMIT 100`,
    [status],
  );
  res.json({ items: rows });
}));

reportsRouter.post('/posts/:id/resolve', idParam, validate(z.object({
  action: z.enum(['dismiss', 'hide_post', 'suspend_author', 'ban_author']),
  days: z.coerce.number().int().min(1).max(365).optional(),
  reason: z.string().trim().max(300).optional(),
}).strict()), ah(async (req, res) => {
  const { action, days, reason } = req.body;
  const { rows: [p] } = await query('SELECT id, user_id, title FROM posts WHERE id = $1', [req.params.id]);
  if (!p) throw notFound('Problem not found');
  const why = reason || 'Violates community guidelines';

  await tx(async (c) => {
    if (action === 'dismiss') {
      await c.query('UPDATE posts SET is_hidden = false, hidden_reason = NULL WHERE id = $1', [p.id]);
    } else {
      await c.query('UPDATE posts SET is_hidden = true, hidden_reason = $2, updated_at = now() WHERE id = $1', [p.id, why]);
    }
    if (action === 'suspend_author') {
      await c.query(
        `UPDATE users SET status = 'suspended', suspended_until = now() + make_interval(days => $2), moderation_reason = $3,
                token_version = token_version + 1 WHERE id = $1 AND status <> 'banned'`,
        [p.user_id, days || 7, why],
      );
    }
    if (action === 'ban_author') {
      await c.query(`UPDATE users SET status = 'banned', suspended_until = NULL, moderation_reason = $2, token_version = token_version + 1 WHERE id = $1`, [p.user_id, why]);
    }
    await c.query(
      `UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE post_id = $1 AND status = 'pending'`,
      [p.id, action === 'dismiss' ? 'dismissed' : 'actioned', req.admin.id],
    );
  });
  if (action !== 'dismiss') await notify(p.user_id, { title: 'Your post was removed after review', body: `"${p.title}" — ${why}` });
  await audit(req, 'report.resolve', p.id, req.body);
  res.json({ ok: true });
}));
