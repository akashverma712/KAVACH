import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, tx } from '../db/pool.js';
import { postCreateLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { IMAGE_EXT, finalizeFiles, imageUpload, publicFilePath } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { audit, notify } from '../services/activity.service.js';
import { ah, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { safeUnlink } from '../utils/files.js';
import { paginate } from '../utils/paginate.js';
import { POST_CATEGORIES, REACTIONS, REPORT_REASONS, uuid } from './schemas.js';

const router = Router();
const idParam = validate(z.object({ id: uuid }), 'params');

export const STATUS_LABEL = {
  open: 'Open',
  marked_for_solving: 'Marked for solving',
  in_progress: 'In progress',
  under_review: 'Under review',
  solved: 'Solved',
  closed: 'Closed',
};

/** Shared SELECT for post cards: author (no contact details), reaction counts, viewer's reaction. */
export const POST_SELECT = (viewerParam) => `
  p.id, p.user_id, p.title, p.description, p.category, p.severity, p.images, p.status, p.visibility,
  p.admin_resolved, p.student_resolved, p.closed_at, p.closed_by, p.is_hidden, p.hidden_reason,
  p.report_count, p.created_at, p.updated_at,
  u.name AS author_name, u.branch AS author_branch, u.batch AS author_batch,
  (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND NOT c.is_deleted) AS comment_count,
  (SELECT COALESCE(json_object_agg(t.type, t.n), '{}'::json)
     FROM (SELECT type, count(*)::int AS n FROM reactions r WHERE r.post_id = p.id GROUP BY type) t) AS reactions,
  (SELECT count(*)::int FROM reactions r WHERE r.post_id = p.id) AS reaction_total,
  (SELECT count(*)::int FROM reactions r WHERE r.post_id = p.id) AS like_count,
  (SELECT count(DISTINCT c.user_id)::int FROM comments c WHERE c.post_id = p.id AND NOT c.is_deleted) AS commenter_count
  ${viewerParam ? `, (SELECT type FROM reactions r WHERE r.post_id = p.id AND r.user_id = ${viewerParam}) AS my_reaction` : ''}`;

export const VISIBILITY = ['everyone', 'admin'];

const listSchema = z.object({
  scope: z.enum(['everyone', 'mine']).optional(),
  mine: z.enum(['true', 'false']).optional(), // older clients
  sort: z.enum(['recent', 'popular', 'liked', 'discussed', 'severity']).default('recent'),
  status: z.enum(['all', 'active', 'open', 'marked_for_solving', 'in_progress', 'under_review', 'solved', 'closed']).default('all'),
  category: z.enum(['all', ...POST_CATEGORIES]).default('all'),
  q: z.string().trim().max(100).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const ORDER = {
  recent: 'p.created_at DESC',
  popular: '(p.like_count * 2 + p.comment_count * 3) DESC, p.created_at DESC',
  liked: 'p.like_count DESC, p.created_at DESC',
  discussed: 'p.comment_count DESC, p.created_at DESC',
  severity: 'p.severity DESC, p.created_at DESC',
};

/**
 * Community feed.
 *   scope=everyone (default): problems shared with everyone, from all students
 *   scope=mine: every problem the student posted, including admin-only and hidden ones
 */
router.get('/', validate(listSchema, 'query'), ah(async (req, res) => {
  const f = req.validatedQuery;
  const scope = f.scope || (f.mine === 'true' ? 'mine' : 'everyone');
  const { page, limit, offset } = paginate(f, { defaultLimit: 15, maxLimit: 50 });
  const params = [req.user.id];
  const where = scope === 'mine'
    ? ['p.user_id = $1']
    : [`p.visibility = 'everyone'`, '(NOT p.is_hidden OR p.user_id = $1)'];
  if (f.status === 'active') where.push(`p.status <> 'closed'`);
  else if (f.status !== 'all') { params.push(f.status); where.push(`p.status = $${params.length}`); }
  if (f.category !== 'all') { params.push(f.category); where.push(`p.category = $${params.length}`); }
  if (f.q) { params.push(`%${f.q.replace(/[%_\\]/g, '\\$&')}%`); where.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
  params.push(limit + 1, offset);

  const { rows } = await query(
    `SELECT * FROM (
       SELECT ${POST_SELECT('$1')} FROM posts p JOIN users u ON u.id = p.user_id
        WHERE ${where.join(' AND ')}
     ) p ORDER BY ${ORDER[f.sort]} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const hasMore = rows.length > limit;
  res.json({ items: rows.slice(0, limit).map((p) => ({ ...p, is_owner: p.user_id === req.user.id })), page, has_more: hasMore, scope });
}));

const createSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(120, 'Title is too long'),
  description: z.string().trim().min(10, 'Describe the problem in at least 10 characters').max(3000, 'Description is too long'),
  category: z.enum(POST_CATEGORIES).default('other'),
  severity: z.coerce.number().int().min(1).max(4).default(2),
  visibility: z.enum(VISIBILITY, { errorMap: () => ({ message: 'Choose who can see this problem: everyone or admin only' }) }).default('everyone'),
});

router.post('/', postCreateLimiter, imageUpload.array('images', 4), validate(createSchema), ah(async (req, res) => {
  const images = await finalizeFiles(req.files || [], 'public', IMAGE_EXT);
  const { title, description, category, severity, visibility } = req.body;
  const post = await tx(async (c) => {
    const { rows: [p] } = await c.query(
      `INSERT INTO posts (user_id, title, description, category, severity, images, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [req.user.id, title, description, category, severity, images.map((i) => i.url), visibility],
    );
    await c.query(`INSERT INTO post_updates (post_id, actor, status, note) VALUES ($1, 'owner', 'open', $2)`,
      [p.id, visibility === 'admin' ? 'Problem posted privately (only the admin can see it)' : 'Problem posted for everyone']);
    return p;
  });
  await audit(req, 'post.create', post.id, { visibility });
  res.status(201).json({ id: post.id, visibility });
}));

async function loadPost(id, viewerId) {
  const { rows: [p] } = await query(
    `SELECT ${POST_SELECT('$2')} FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [id, viewerId],
  );
  // Admin-only problems are visible to the student who posted them (admins use the admin API)
  if (!p || (p.user_id !== viewerId && (p.is_hidden || p.visibility !== 'everyone'))) throw notFound('This problem is no longer available');
  return p;
}

/** Likes and comments exist only on problems shared with everyone. */
function requirePublic(p) {
  if (p.visibility !== 'everyone') {
    throw forbidden('Likes and comments are only available on problems shared with everyone', 'PRIVATE_POST');
  }
}

router.get('/:id', idParam, ah(async (req, res) => {
  const p = await loadPost(req.params.id, req.user.id);
  const [{ rows: updates }, { rows: reported }] = await Promise.all([
    query('SELECT id, actor, status, note, created_at FROM post_updates WHERE post_id = $1 ORDER BY created_at', [p.id]),
    query('SELECT 1 FROM reports WHERE post_id = $1 AND reporter_id = $2', [p.id, req.user.id]),
  ]);
  res.json({ post: { ...p, is_owner: p.user_id === req.user.id, i_reported: reported.length > 0 }, updates });
}));

router.delete('/:id', writeLimiter, idParam, ah(async (req, res) => {
  const { rows: [p] } = await query('DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING images', [req.params.id, req.user.id]);
  if (!p) throw notFound('Problem not found');
  await Promise.all(p.images.map((u) => safeUnlink(publicFilePath(u))));
  await audit(req, 'post.delete', req.params.id);
  res.json({ ok: true });
}));

/* ───── Reactions ───── */

// Like = "I face this too". One per student per problem; tapping again removes it.
router.post('/:id/like', writeLimiter, idParam, ah(async (req, res) => {
  const p = await loadPost(req.params.id, req.user.id);
  requirePublic(p);
  const { rowCount } = await query(`DELETE FROM reactions WHERE post_id = $1 AND user_id = $2`, [p.id, req.user.id]);
  if (!rowCount) await query(`INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, 'like') ON CONFLICT DO NOTHING`, [p.id, req.user.id]);
  const { rows: [{ n }] } = await query('SELECT count(*)::int AS n FROM reactions WHERE post_id = $1', [p.id]);
  res.json({ liked: !rowCount, like_count: n });
}));

router.post('/:id/react', writeLimiter, idParam, validate(z.object({ type: z.enum(REACTIONS) }).strict()), ah(async (req, res) => {
  const p = await loadPost(req.params.id, req.user.id);
  requirePublic(p);
  if (p.my_reaction === req.body.type) {
    await query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [p.id, req.user.id]);
  } else {
    await query(
      `INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET type = EXCLUDED.type, created_at = now()`,
      [p.id, req.user.id, req.body.type],
    );
  }
  const fresh = await loadPost(p.id, req.user.id);
  res.json({ reactions: fresh.reactions, reaction_total: fresh.reaction_total, like_count: fresh.like_count, my_reaction: fresh.my_reaction });
}));

/* ───── Comments ───── */

router.get('/:id/comments', idParam, ah(async (req, res) => {
  const post = await loadPost(req.params.id, req.user.id);
  if (post.visibility !== 'everyone') return res.json({ items: [] });
  const { limit, offset } = paginate(req.query, { defaultLimit: 50, maxLimit: 100 });
  const { rows } = await query(
    `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author_name, u.branch AS author_branch, u.batch AS author_batch
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1 AND NOT c.is_deleted
      ORDER BY c.created_at ASC LIMIT $2 OFFSET $3`,
    [req.params.id, limit, offset],
  );
  res.json({ items: rows.map((c) => ({ ...c, is_mine: c.user_id === req.user.id })) });
}));

router.post('/:id/comments', writeLimiter, idParam, validate(z.object({
  body: z.string().trim().min(1, 'Write a comment').max(1000, 'Comments can be up to 1000 characters'),
}).strict()), ah(async (req, res) => {
  const p = await loadPost(req.params.id, req.user.id);
  requirePublic(p);
  if (p.status === 'closed') throw badRequest('This problem is closed, so new comments are turned off', 'POST_CLOSED');
  const { rows: [c] } = await query(
    'INSERT INTO comments (post_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at, user_id',
    [p.id, req.user.id, req.body.body],
  );
  if (p.user_id !== req.user.id) {
    await notify(p.user_id, { title: `${req.user.name} commented on your problem`, body: p.title, link: `/app/community/${p.id}` });
  }
  res.status(201).json({ comment: { ...c, author_name: req.user.name, author_branch: req.user.branch, author_batch: req.user.batch, is_mine: true } });
}));

router.delete('/:id/comments/:commentId', writeLimiter, validate(z.object({ id: uuid, commentId: uuid }), 'params'), ah(async (req, res) => {
  const { rowCount } = await query(
    'UPDATE comments SET is_deleted = true WHERE id = $1 AND post_id = $2 AND user_id = $3 AND NOT is_deleted',
    [req.params.commentId, req.params.id, req.user.id],
  );
  if (!rowCount) throw notFound('Comment not found');
  res.json({ ok: true });
}));

/* ───── Reporting ───── */

router.post('/:id/report', writeLimiter, idParam, validate(z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
}).strict()), ah(async (req, res) => {
  const p = await loadPost(req.params.id, req.user.id);
  if (p.user_id === req.user.id) throw badRequest('You cannot report your own post');
  try {
    await query('INSERT INTO reports (post_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4)',
      [p.id, req.user.id, req.body.reason, req.body.details || null]);
  } catch (err) {
    if (err.code === '23505') throw conflict('You have already reported this post', 'ALREADY_REPORTED');
    throw err;
  }
  const { rows: [r] } = await query(
    `UPDATE posts SET report_count = report_count + 1,
            is_hidden = is_hidden OR (report_count + 1 >= $2),
            hidden_reason = CASE WHEN NOT is_hidden AND report_count + 1 >= $2 THEN 'Hidden automatically after multiple reports — pending admin review' ELSE hidden_reason END
      WHERE id = $1 RETURNING is_hidden`,
    [p.id, env.autoHideReportThreshold],
  );
  await audit(req, 'post.report', p.id, { reason: req.body.reason });
  res.status(201).json({ ok: true, hidden: r.is_hidden });
}));

/* ───── Owner lifecycle ───── */

async function ownPost(req) {
  const { rows: [p] } = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (!p) throw notFound('Problem not found');
  if (p.user_id !== req.user.id) throw forbidden('Only the person who posted this problem can do that');
  if (p.status === 'closed') throw badRequest('This problem is already closed', 'POST_CLOSED');
  return p;
}

// The owner may close their problem at any time.
router.post('/:id/close', writeLimiter, idParam, validate(z.object({ note: z.string().trim().max(300).optional() }).strict()), ah(async (req, res) => {
  const p = await ownPost(req);
  await tx(async (c) => {
    await c.query(`UPDATE posts SET status = 'closed', closed_by = 'owner', closed_at = now(), updated_at = now() WHERE id = $1`, [p.id]);
    await c.query(`INSERT INTO post_updates (post_id, actor, status, note) VALUES ($1, 'owner', 'closed', $2)`, [p.id, req.body.note || 'Closed by the student who raised it']);
  });
  res.json({ ok: true, status: 'closed' });
}));

// After the admin marks it solved, the owner confirms → closes when both agree.
router.post('/:id/confirm-resolved', writeLimiter, idParam, ah(async (req, res) => {
  const p = await ownPost(req);
  if (!p.admin_resolved || p.status !== 'solved') throw badRequest('You can confirm once the admin has marked this problem as solved', 'NOT_SOLVED_YET');
  await tx(async (c) => {
    await c.query(`UPDATE posts SET student_resolved = true, status = 'closed', closed_by = 'mutual', closed_at = now(), updated_at = now() WHERE id = $1`, [p.id]);
    await c.query(`INSERT INTO post_updates (post_id, actor, status, note) VALUES ($1, 'owner', 'closed', 'Student confirmed the problem is resolved')`, [p.id]);
  });
  res.json({ ok: true, status: 'closed' });
}));

// The owner says the "solved" problem still persists → back to review.
router.post('/:id/reopen', writeLimiter, idParam, validate(z.object({ note: z.string().trim().max(300).optional() }).strict()), ah(async (req, res) => {
  const p = await ownPost(req);
  if (p.status !== 'solved') throw badRequest('Only problems marked as solved can be sent back for review');
  await tx(async (c) => {
    await c.query(`UPDATE posts SET status = 'under_review', admin_resolved = false, student_resolved = false, updated_at = now() WHERE id = $1`, [p.id]);
    await c.query(`INSERT INTO post_updates (post_id, actor, status, note) VALUES ($1, 'owner', 'under_review', $2)`,
      [p.id, req.body.note ? `Student says it is not resolved yet: ${req.body.note}` : 'Student says it is not resolved yet']);
  });
  res.json({ ok: true, status: 'under_review' });
}));

export default router;
