import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { fundraiserCreateLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { IMAGE_EXT, PROOF_EXT, finalizeFiles, imageUpload, privateFilePath } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../services/activity.service.js';
import { ah, badRequest, notFound } from '../utils/errors.js';
import { paginate } from '../utils/paginate.js';
import { uuid } from './schemas.js';

const router = Router();
const idParam = validate(z.object({ id: uuid }), 'params');

export const FUND_SELECT = `
  f.id, f.user_id, f.title, f.story, f.beneficiary_name, f.amount_needed, f.amount_raised, f.severity,
  f.upi_id, f.qr_images, jsonb_array_length(f.proof_files) AS proof_count, f.status, f.admin_note,
  f.reviewed_at, f.created_at, f.updated_at,
  u.name AS organiser_name, u.branch AS organiser_branch, u.batch AS organiser_batch`;

router.get('/', validate(z.object({
  scope: z.enum(['active', 'mine']).default('active'),
  page: z.string().optional(),
  limit: z.string().optional(),
}), 'query'), ah(async (req, res) => {
  const { scope } = req.validatedQuery;
  const { page, limit, offset } = paginate(req.validatedQuery, { defaultLimit: 12, maxLimit: 50 });
  const where = scope === 'mine' ? 'f.user_id = $1' : `f.status = 'approved'`;
  const params = scope === 'mine' ? [req.user.id, limit + 1, offset] : [limit + 1, offset];
  const off = scope === 'mine' ? 2 : 1;
  const { rows } = await query(
    `SELECT ${FUND_SELECT} FROM fundraisers f JOIN users u ON u.id = f.user_id
      WHERE ${where}
      ORDER BY ${scope === 'mine' ? 'f.created_at DESC' : 'f.severity DESC, f.created_at DESC'}
      LIMIT $${off} OFFSET $${off + 1}`,
    params,
  );
  res.json({
    items: rows.slice(0, limit).map((f) => ({ ...f, is_owner: f.user_id === req.user.id, admin_note: f.user_id === req.user.id ? f.admin_note : null })),
    page,
    has_more: rows.length > limit,
  });
}));

const createSchema = z.object({
  title: z.string().trim().min(8, 'Title must be at least 8 characters').max(120),
  story: z.string().trim().min(30, 'Tell people what happened in at least 30 characters').max(5000),
  beneficiary_name: z.string().trim().min(2, 'Enter who the money is for').max(80),
  amount_needed: z.coerce.number({ invalid_type_error: 'Enter the amount needed' }).positive('Enter the amount needed').max(10_000_000, 'Amount is too large'),
  severity: z.coerce.number().int().min(1).max(4).default(3),
  upi_id: z.string().trim().max(100).optional().transform((v) => v || null)
    .refine((v) => !v || /^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(v), 'Enter a valid UPI ID (like name@okbank)'),
});

router.post(
  '/',
  fundraiserCreateLimiter,
  imageUpload.fields([{ name: 'qr_images', maxCount: 5 }, { name: 'proofs', maxCount: 5 }]),
  validate(createSchema),
  ah(async (req, res) => {
    const qrFiles = req.files?.qr_images || [];
    const proofFiles = req.files?.proofs || [];
    if (!qrFiles.length) throw badRequest('Add at least one payment QR code', 'QR_REQUIRED');
    if (!proofFiles.length) throw badRequest('Add proof such as a hospital bill, report or accident photo', 'PROOF_REQUIRED');

    const qr = await finalizeFiles(qrFiles, 'public', IMAGE_EXT);
    const proofs = await finalizeFiles(proofFiles, 'private', PROOF_EXT);
    const b = req.body;
    const { rows: [f] } = await query(
      `INSERT INTO fundraisers (user_id, title, story, beneficiary_name, amount_needed, severity, upi_id, qr_images, proof_files)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [req.user.id, b.title, b.story, b.beneficiary_name, b.amount_needed, b.severity, b.upi_id,
        qr.map((q) => q.url), JSON.stringify(proofs.map(({ name, mime, original, size }) => ({ name, mime, original, size })))],
    );
    await audit(req, 'fundraiser.create', f.id);
    res.status(201).json({ id: f.id, status: 'pending' });
  }),
);

router.get('/:id', idParam, ah(async (req, res) => {
  const { rows: [f] } = await query(`SELECT ${FUND_SELECT} FROM fundraisers f JOIN users u ON u.id = f.user_id WHERE f.id = $1`, [req.params.id]);
  if (!f || (f.status !== 'approved' && f.user_id !== req.user.id && f.status !== 'closed')) throw notFound('Fundraiser not found');
  const isOwner = f.user_id === req.user.id;
  res.json({ fundraiser: { ...f, is_owner: isOwner, admin_note: isOwner ? f.admin_note : null } });
}));

router.patch('/:id/raised', writeLimiter, idParam, validate(z.object({
  amount_raised: z.coerce.number().min(0).max(10_000_000),
}).strict()), ah(async (req, res) => {
  const { rows: [f] } = await query(
    `UPDATE fundraisers SET amount_raised = $3, updated_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'approved' RETURNING id, amount_raised`,
    [req.params.id, req.user.id, req.body.amount_raised],
  );
  if (!f) throw notFound('Only approved fundraisers you started can be updated');
  res.json({ amount_raised: f.amount_raised });
}));

router.post('/:id/close', writeLimiter, idParam, ah(async (req, res) => {
  const { rows: [f] } = await query(
    `UPDATE fundraisers SET status = 'closed', updated_at = now()
      WHERE id = $1 AND user_id = $2 AND status IN ('approved', 'pending') RETURNING id`,
    [req.params.id, req.user.id],
  );
  if (!f) throw notFound('Fundraiser not found');
  await audit(req, 'fundraiser.close', f.id);
  res.json({ ok: true, status: 'closed' });
}));

// Proof documents are private: only the organiser (here) and admins (admin route) can open them.
router.get('/:id/proofs/:index', validate(z.object({ id: uuid, index: z.coerce.number().int().min(0).max(9) }), 'params'), ah(async (req, res) => {
  const { rows: [f] } = await query('SELECT proof_files FROM fundraisers WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const file = f?.proof_files?.[Number(req.params.index)];
  if (!file) throw notFound('File not found');
  const p = privateFilePath(file.name);
  if (!fs.existsSync(p)) throw notFound('File not found');
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="proof-${Number(req.params.index) + 1}.${file.name.split('.').pop()}"`);
  fs.createReadStream(p).pipe(res);
}));

export default router;
