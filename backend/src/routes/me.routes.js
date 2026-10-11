import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { signUserToken } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../services/activity.service.js';
import { getAdminEmergencyContact } from '../services/settings.service.js';
import { ah, badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import { paginate } from '../utils/paginate.js';
import { normalizeContactPhone } from '../utils/phone.js';
import { USER_FIELDS, publicUser } from './auth.routes.js';
import { nameSchema, optionalText, passwordSchema, uuid } from './schemas.js';

const router = Router();
const MAX_CONTACTS = 5;

/** Link to the college roster if the admin added this student after they registered. */
async function linkRosterIfMissing(user) {
  if (user.college_record_id) return user;
  const { rows: [rec] } = await query(
    `SELECT cr.* FROM college_records cr
      WHERE (($1::text IS NOT NULL AND cr.email = $1) OR ($2::text IS NOT NULL AND cr.phone = $2))
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.college_record_id = cr.id)
      LIMIT 1`,
    [user.email, user.phone],
  );
  if (!rec) return user;
  const { rows: [updated] } = await query(
    `UPDATE users SET college_record_id = $2,
            branch = COALESCE(branch, $3), batch = COALESCE(batch, $4), regd_no = COALESCE(regd_no, $5), updated_at = now()
      WHERE id = $1 RETURNING ${USER_FIELDS}`,
    [user.id, rec.id, rec.branch, rec.batch, rec.regd_no],
  );
  return updated;
}

router.get('/', ah(async (req, res) => {
  const user = await linkRosterIfMissing(req.user);
  res.json({ user: publicUser(user) });
}));

// Email and phone are intentionally not accepted here (.strict() rejects them).
const profileSchema = z.object({
  name: nameSchema.optional(),
  branch: optionalText(80),
  batch: optionalText(20),
  regd_no: optionalText(30),
}).strict({ message: 'Email and phone number cannot be changed here' });

router.patch('/', writeLimiter, validate(profileSchema), ah(async (req, res) => {
  const b = req.body;
  const { rows: [user] } = await query(
    `UPDATE users SET
        name    = COALESCE($2, name),
        branch  = CASE WHEN $3::boolean THEN $4 ELSE branch END,
        batch   = CASE WHEN $5::boolean THEN $6 ELSE batch END,
        regd_no = CASE WHEN $7::boolean THEN $8 ELSE regd_no END,
        updated_at = now()
      WHERE id = $1 RETURNING ${USER_FIELDS}`,
    [req.user.id, b.name ?? null, b.branch !== undefined, b.branch ?? null, b.batch !== undefined, b.batch ?? null, b.regd_no !== undefined, b.regd_no ?? null],
  );
  await audit(req, 'user.profile_update', req.user.id, { fields: Object.keys(b) });
  res.json({ user: publicUser(user) });
}));

router.post('/password', writeLimiter, validate(z.object({
  current_password: z.string().min(1, 'Enter your current password').max(72),
  new_password: passwordSchema,
}).strict()), ah(async (req, res) => {
  const { rows: [row] } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(req.body.current_password, row.password_hash))) {
    throw unauthorized('Your current password is incorrect', 'INVALID_PASSWORD');
  }
  const hash = await bcrypt.hash(req.body.new_password, env.bcryptRounds);
  const { rows: [user] } = await query(
    'UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING id, token_version',
    [req.user.id, hash],
  );
  await audit(req, 'user.password_change', req.user.id);
  res.json({ token: signUserToken(user) }); // other devices are signed out
}));

/* ───────────── Emergency contacts ───────────── */

async function contactsPayload(userId) {
  const [admin, { rows }] = await Promise.all([
    getAdminEmergencyContact(),
    query('SELECT id, name, phone, relation, created_at FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at', [userId]),
  ]);
  return {
    system: admin.phone ? [{ id: 'admin', name: admin.name, phone: admin.phone, relation: 'Campus admin', locked: true }] : [],
    contacts: rows,
    max: MAX_CONTACTS,
  };
}

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter the contact\'s name').max(60),
  phone: z.string().trim().min(8, 'Enter a phone number').max(20),
  relation: optionalText(40),
}).strict();

router.get('/contacts', ah(async (req, res) => res.json(await contactsPayload(req.user.id))));

router.post('/contacts', writeLimiter, validate(contactSchema), ah(async (req, res) => {
  const phone = normalizeContactPhone(req.body.phone);
  if (!phone) throw badRequest('Enter a valid 10-digit mobile number, or an international number starting with +', 'INVALID_PHONE');
  const { rows: [{ n }] } = await query('SELECT count(*)::int AS n FROM emergency_contacts WHERE user_id = $1', [req.user.id]);
  if (n >= MAX_CONTACTS) throw badRequest(`You can save up to ${MAX_CONTACTS} emergency contacts`, 'CONTACT_LIMIT');
  try {
    await query('INSERT INTO emergency_contacts (user_id, name, phone, relation) VALUES ($1, $2, $3, $4)',
      [req.user.id, req.body.name, phone, req.body.relation ?? null]);
  } catch (err) {
    if (err.code === '23505') throw conflict('This number is already in your emergency contacts', 'CONTACT_EXISTS');
    throw err;
  }
  res.status(201).json(await contactsPayload(req.user.id));
}));

router.patch('/contacts/:id', writeLimiter, validate(z.object({ id: uuid }), 'params'), validate(contactSchema.partial()), ah(async (req, res) => {
  let phone;
  if (req.body.phone !== undefined) {
    phone = normalizeContactPhone(req.body.phone);
    if (!phone) throw badRequest('Enter a valid 10-digit mobile number, or an international number starting with +', 'INVALID_PHONE');
  }
  try {
    const { rowCount } = await query(
      `UPDATE emergency_contacts SET name = COALESCE($3, name), phone = COALESCE($4, phone),
              relation = CASE WHEN $5::boolean THEN $6 ELSE relation END
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id, req.body.name ?? null, phone ?? null, req.body.relation !== undefined, req.body.relation ?? null],
    );
    if (!rowCount) throw notFound('Contact not found');
  } catch (err) {
    if (err.code === '23505') throw conflict('This number is already in your emergency contacts', 'CONTACT_EXISTS');
    throw err;
  }
  res.json(await contactsPayload(req.user.id));
}));

router.delete('/contacts/:id', writeLimiter, validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  const { rowCount } = await query('DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) throw notFound('Contact not found');
  res.json(await contactsPayload(req.user.id));
}));

/* ───────────── Notifications ───────────── */

router.get('/notifications', ah(async (req, res) => {
  const { limit, offset } = paginate(req.query, { defaultLimit: 30, maxLimit: 100 });
  const [{ rows: items }, { rows: [{ unread }] }] = await Promise.all([
    query('SELECT id, title, body, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]),
    query('SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]),
  ]);
  res.json({ items, unread });
}));

router.post('/notifications/read-all', ah(async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));

router.post('/notifications/:id/read', validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  await query('UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

export default router;
