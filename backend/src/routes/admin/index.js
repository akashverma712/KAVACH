import { Router } from 'express';
import { z } from 'zod';
import { chatbotConfig, isSmtpConfigured, isTwilioConfigured } from '../../config/env.js';
import { query } from '../../db/pool.js';
import { requireAdmin } from '../../middleware/auth.js';
import { adminWriteLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/activity.service.js';
import { answerQuestion } from '../../services/chatbot.service.js';
import { getAdminEmergencyContact, setSetting } from '../../services/settings.service.js';
import { ah, badRequest, notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/paginate.js';
import { normalizeContactPhone } from '../../utils/phone.js';
import { uuid } from '../schemas.js';
import authRoutes from './auth.routes.js';
import fundraiserRoutes from './fundraisers.routes.js';
import { postsRouter, reportsRouter } from './posts.routes.js';
import studentRoutes from './students.routes.js';
import userRoutes from './users.routes.js';

const router = Router();
router.use('/auth', authRoutes);

// Everything below requires an admin session
router.use(requireAdmin);
router.use((req, res, next) => (req.method === 'GET' ? next() : adminWriteLimiter(req, res, next)));

const delivery = () => ({
  email: isSmtpConfigured() ? 'smtp' : 'console',
  sms: isTwilioConfigured() ? 'twilio' : 'console',
  chatbot: chatbotConfig().apiKey ? 'ai' : 'knowledge_base',
});

router.get('/dashboard', ah(async (_req, res) => {
  const [{ rows: [stats] }, { rows: byStatus }, { rows: sos }, { rows: posts }, { rows: funds }, { rows: trend }] = await Promise.all([
    query(`SELECT
      (SELECT count(*)::int FROM college_records) AS roster,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS users_week,
      (SELECT count(*)::int FROM posts WHERE status <> 'closed') AS open_problems,
      (SELECT count(*)::int FROM posts WHERE status <> 'closed' AND severity >= 3) AS urgent_problems,
      (SELECT count(*)::int FROM fundraisers WHERE status = 'pending') AS pending_fundraisers,
      (SELECT count(*)::int FROM sos_events WHERE created_at > now() - interval '24 hours') AS sos_24h,
      (SELECT count(*)::int FROM sos_events WHERE acknowledged_at IS NULL AND created_at > now() - interval '7 days') AS sos_unacknowledged,
      (SELECT count(DISTINCT post_id)::int FROM reports WHERE status = 'pending') AS pending_reports,
      (SELECT count(*)::int FROM users WHERE status <> 'active') AS moderated_users`),
    query(`SELECT status, count(*)::int AS n FROM posts GROUP BY status`),
    query(`SELECT s.id, s.lat, s.lng, s.trigger, s.status, s.acknowledged_at, s.created_at, u.name, u.regd_no, u.phone
             FROM sos_events s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 6`),
    query(`SELECT p.id, p.title, p.severity, p.status, p.created_at, p.report_count, u.name AS author_name
             FROM posts p JOIN users u ON u.id = p.user_id WHERE p.status <> 'closed'
             ORDER BY p.severity DESC, p.created_at DESC LIMIT 6`),
    query(`SELECT f.id, f.title, f.amount_needed, f.severity, f.created_at, u.name AS organiser_name
             FROM fundraisers f JOIN users u ON u.id = f.user_id WHERE f.status = 'pending' ORDER BY f.created_at LIMIT 5`),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
                  (SELECT count(*)::int FROM posts p WHERE p.created_at::date = d) AS problems,
                  (SELECT count(*)::int FROM sos_events s WHERE s.created_at::date = d) AS sos
             FROM generate_series(current_date - 13, current_date, interval '1 day') d`),
  ]);
  res.json({
    stats,
    problems_by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    recent_sos: sos,
    urgent_problems: posts,
    pending_fundraisers: funds,
    trend,
    delivery: delivery(),
  });
}));

/* ───────────── SOS alerts ───────────── */

router.get('/sos', ah(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { defaultLimit: 25, maxLimit: 100 });
  const filter = req.query.filter === 'unacknowledged' ? 'WHERE s.acknowledged_at IS NULL' : '';
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(
      `SELECT s.*, u.name, u.regd_no, u.phone, u.email, u.branch, u.batch, a.name AS acknowledged_by_name
         FROM sos_events s JOIN users u ON u.id = s.user_id LEFT JOIN admins a ON a.id = s.acknowledged_by
         ${filter} ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    query(`SELECT count(*)::int AS total FROM sos_events s ${filter}`),
  ]);
  res.json({ items: rows, total, page, limit });
}));

router.post('/sos/:id/acknowledge', validate(z.object({ id: uuid }), 'params'), validate(z.object({
  note: z.string().trim().max(500).optional(),
}).strict()), ah(async (req, res) => {
  const { rows: [s] } = await query(
    `UPDATE sos_events SET acknowledged_at = COALESCE(acknowledged_at, now()), acknowledged_by = COALESCE(acknowledged_by, $2), admin_note = COALESCE($3, admin_note)
      WHERE id = $1 RETURNING id, acknowledged_at`,
    [req.params.id, req.admin.id, req.body.note || null],
  );
  if (!s) throw notFound('Alert not found');
  await audit(req, 'sos.acknowledge', s.id);
  res.json(s);
}));

/* ───────────── Chatbot knowledge base ───────────── */

const faqSchema = z.object({
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(3000),
  keywords: z.string().trim().max(500).optional().default(''),
  category: z.string().trim().min(2).max(40).optional().default('general'),
}).strict();

router.get('/faqs', ah(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const params = q ? [`%${q.replace(/[%_\\]/g, '\\$&')}%`] : [];
  const { rows } = await query(
    `SELECT id, question, answer, keywords, category, created_at, updated_at FROM faqs
      ${q ? 'WHERE question ILIKE $1 OR answer ILIKE $1 OR keywords ILIKE $1' : ''}
      ORDER BY category, question`,
    params,
  );
  res.json({ items: rows });
}));

router.post('/faqs', validate(faqSchema), ah(async (req, res) => {
  const { question, answer, keywords, category } = req.body;
  const { rows: [f] } = await query('INSERT INTO faqs (question, answer, keywords, category) VALUES ($1, $2, $3, $4) RETURNING id', [question, answer, keywords, category]);
  await audit(req, 'faq.create', f.id);
  res.status(201).json({ id: f.id });
}));

router.patch('/faqs/:id', validate(z.object({ id: uuid }), 'params'), validate(faqSchema.partial()), ah(async (req, res) => {
  const b = req.body;
  const { rowCount } = await query(
    `UPDATE faqs SET question = COALESCE($2, question), answer = COALESCE($3, answer), keywords = COALESCE($4, keywords),
            category = COALESCE($5, category), updated_at = now() WHERE id = $1`,
    [req.params.id, b.question ?? null, b.answer ?? null, b.keywords ?? null, b.category ?? null],
  );
  if (!rowCount) throw notFound('Answer not found');
  await audit(req, 'faq.update', req.params.id);
  res.json({ ok: true });
}));

router.delete('/faqs/:id', validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  const { rowCount } = await query('DELETE FROM faqs WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Answer not found');
  await audit(req, 'faq.delete', req.params.id);
  res.json({ ok: true });
}));

router.post('/faqs/test', validate(z.object({ message: z.string().trim().min(1).max(500) }).strict()), ah(async (req, res) => {
  res.json(await answerQuestion(req.body.message));
}));

/* ───────────── Settings & system ───────────── */

router.get('/settings', ah(async (req, res) => {
  res.json({ emergency: await getAdminEmergencyContact(), admin: req.admin, delivery: delivery() });
}));

router.put('/settings', validate(z.object({
  admin_emergency_phone: z.string().trim().min(8).max(20),
  admin_emergency_name: z.string().trim().min(2).max(60),
}).strict()), ah(async (req, res) => {
  const phone = normalizeContactPhone(req.body.admin_emergency_phone);
  if (!phone) throw badRequest('Enter a valid 10-digit mobile number or an international number starting with +', 'INVALID_PHONE');
  await setSetting('admin_emergency_phone', phone);
  await setSetting('admin_emergency_name', req.body.admin_emergency_name);
  await audit(req, 'settings.update', null, { admin_emergency_phone: phone });
  res.json({ emergency: await getAdminEmergencyContact() });
}));

router.get('/audit', ah(async (req, res) => {
  const { limit, offset } = paginate(req.query, { defaultLimit: 50, maxLimit: 200 });
  const { rows } = await query(
    `SELECT l.id, l.actor_type, l.action, l.target, l.meta, l.ip, l.created_at,
            COALESCE(a.name, u.name) AS actor_name
       FROM audit_logs l
       LEFT JOIN admins a ON l.actor_type = 'admin' AND a.id = l.actor_id
       LEFT JOIN users u ON l.actor_type = 'user' AND u.id = l.actor_id
      ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  res.json({ items: rows });
}));

router.use('/students', studentRoutes);
router.use('/users', userRoutes);
router.use('/posts', postsRouter);
router.use('/reports', reportsRouter);
router.use('/fundraisers', fundraiserRoutes);

export default router;
