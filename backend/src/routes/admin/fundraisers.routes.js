import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { privateFilePath } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { audit, notify } from '../../services/activity.service.js';
import { ah, badRequest, notFound } from '../../utils/errors.js';
import { FUND_SELECT } from '../fundraisers.routes.js';
import { uuid } from '../schemas.js';

const router = Router();
const idParam = validate(z.object({ id: uuid }), 'params');

router.get('/', ah(async (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'closed', 'all'].includes(req.query.status) ? req.query.status : 'pending';
  const { rows } = await query(
    `SELECT ${FUND_SELECT}, u.email AS organiser_email, u.phone AS organiser_phone, u.regd_no AS organiser_regd_no
       FROM fundraisers f JOIN users u ON u.id = f.user_id
      ${status === 'all' ? '' : 'WHERE f.status = $1'}
      ORDER BY ${status === 'pending' ? 'f.severity DESC, f.created_at ASC' : 'f.created_at DESC'}
      LIMIT 200`,
    status === 'all' ? [] : [status],
  );
  const { rows: counts } = await query('SELECT status, count(*)::int AS n FROM fundraisers GROUP BY status');
  res.json({ items: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
}));

router.get('/:id', idParam, ah(async (req, res) => {
  const { rows: [f] } = await query(
    `SELECT ${FUND_SELECT}, f.proof_files, u.email AS organiser_email, u.phone AS organiser_phone, u.regd_no AS organiser_regd_no
       FROM fundraisers f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
    [req.params.id],
  );
  if (!f) throw notFound('Fundraiser not found');
  f.proof_files = f.proof_files.map((p, i) => ({ index: i, mime: p.mime, original: p.original, size: p.size }));
  res.json({ fundraiser: f });
}));

router.get('/:id/proofs/:index', validate(z.object({ id: uuid, index: z.coerce.number().int().min(0).max(9) }), 'params'), ah(async (req, res) => {
  const { rows: [f] } = await query('SELECT proof_files FROM fundraisers WHERE id = $1', [req.params.id]);
  const file = f?.proof_files?.[Number(req.params.index)];
  if (!file) throw notFound('File not found');
  const p = privateFilePath(file.name);
  if (!fs.existsSync(p)) throw notFound('File not found');
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(p).pipe(res);
}));

router.post('/:id/review', idParam, validate(z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
}).strict()), ah(async (req, res) => {
  const { decision, note } = req.body;
  if (decision === 'reject' && !note) throw badRequest('Tell the student why the fundraiser was rejected', 'NOTE_REQUIRED');
  const { rows: [f] } = await query(
    `UPDATE fundraisers SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now()
      WHERE id = $1 AND status IN ('pending', 'rejected', 'approved') RETURNING id, user_id, title, status`,
    [req.params.id, decision === 'approve' ? 'approved' : 'rejected', note || null, req.admin.id],
  );
  if (!f) throw notFound('Fundraiser not found or already closed');
  await notify(f.user_id, decision === 'approve'
    ? { title: 'Your fundraiser is live', body: `"${f.title}" is now visible to all students.`, link: `/app/fundraisers/${f.id}` }
    : { title: 'Your fundraiser needs changes', body: `"${f.title}" — ${note}`, link: `/app/fundraisers/${f.id}` });
  await audit(req, `fundraiser.${decision}`, f.id, { note });
  res.json({ status: f.status });
}));

router.post('/:id/close', idParam, ah(async (req, res) => {
  const { rows: [f] } = await query(`UPDATE fundraisers SET status = 'closed', updated_at = now() WHERE id = $1 RETURNING id, user_id, title`, [req.params.id]);
  if (!f) throw notFound('Fundraiser not found');
  await notify(f.user_id, { title: 'Your fundraiser was closed by the admin', body: f.title, link: `/app/fundraisers/${f.id}` });
  await audit(req, 'fundraiser.admin_close', f.id);
  res.json({ status: 'closed' });
}));

export default router;
