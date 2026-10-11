import fs from 'node:fs/promises';
import { Router } from 'express';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { importLimiter } from '../../middleware/rateLimit.js';
import { sheetUpload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/activity.service.js';
import { ah, badRequest, conflict, notFound } from '../../utils/errors.js';
import { safeUnlink } from '../../utils/files.js';
import { paginate } from '../../utils/paginate.js';
import { normalizeEmail, normalizePhone } from '../../utils/phone.js';
import { uuid } from '../schemas.js';

const router = Router();
const MAX_ROWS = 5000;

const recordSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  branch: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
  batch: z.string().trim().max(20).optional().nullable().transform((v) => v || null),
  regd_no: z.string().trim().min(2, 'Registration number is required').max(30).transform((v) => v.toUpperCase()),
  email: z.string().trim().max(254).optional().nullable().transform((v) => v || null),
  phone: z.string().trim().max(20).optional().nullable().transform((v) => v || null),
}).strict();

function cleanRecord(input) {
  const r = recordSchema.parse(input);
  if (r.email) {
    const e = normalizeEmail(r.email);
    if (!e) throw badRequest(`"${r.email}" is not a valid email`, 'INVALID_EMAIL');
    r.email = e;
  }
  if (r.phone) {
    const p = normalizePhone(r.phone);
    if (!p) throw badRequest(`"${r.phone}" is not a valid 10-digit mobile number`, 'INVALID_PHONE');
    r.phone = p;
  }
  return r;
}

/** Copy roster details to registered students who match by email/phone but aren't linked yet. */
async function linkUsers() {
  await query(
    `UPDATE users u SET college_record_id = cr.id,
            branch = COALESCE(u.branch, cr.branch), batch = COALESCE(u.batch, cr.batch), regd_no = COALESCE(u.regd_no, cr.regd_no)
       FROM college_records cr
      WHERE u.college_record_id IS NULL
        AND ((u.email IS NOT NULL AND u.email = cr.email) OR (u.phone IS NOT NULL AND u.phone = cr.phone))
        AND NOT EXISTS (SELECT 1 FROM users x WHERE x.college_record_id = cr.id)`,
  );
}

router.get('/', ah(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { defaultLimit: 25, maxLimit: 100 });
  const q = String(req.query.q || '').trim().slice(0, 100);
  const params = [];
  let where = 'TRUE';
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
    where = `(cr.name ILIKE $1 OR cr.regd_no ILIKE $1 OR cr.email ILIKE $1 OR cr.phone ILIKE $1 OR cr.branch ILIKE $1 OR cr.batch ILIKE $1)`;
  }
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    query(
      `SELECT cr.*, EXISTS (SELECT 1 FROM users u WHERE u.college_record_id = cr.id) AS registered
         FROM college_records cr WHERE ${where}
        ORDER BY cr.created_at DESC, cr.regd_no LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    query(`SELECT count(*)::int AS total FROM college_records cr WHERE ${where}`, params),
  ]);
  res.json({ items: rows, total, page, limit });
}));

router.post('/', ah(async (req, res) => {
  const r = cleanRecord(req.body);
  try {
    const { rows: [rec] } = await query(
      `INSERT INTO college_records (name, branch, batch, regd_no, email, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [r.name, r.branch, r.batch, r.regd_no, r.email, r.phone],
    );
    await linkUsers();
    await audit(req, 'roster.create', rec.id);
    res.status(201).json({ record: rec });
  } catch (err) {
    if (err.code === '23505') throw conflict(duplicateMessage(err), 'DUPLICATE');
    throw err;
  }
}));

const duplicateMessage = (err) => {
  const c = err.constraint || '';
  if (c.includes('regd')) return 'A student with this registration number already exists';
  if (c.includes('email')) return 'Another student already uses this email';
  if (c.includes('phone')) return 'Another student already uses this phone number';
  return 'This student already exists';
};

router.patch('/:id', validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  const { rows: [existing] } = await query('SELECT * FROM college_records WHERE id = $1', [req.params.id]);
  if (!existing) throw notFound('Student not found');
  const pick = ({ name, branch, batch, regd_no: regdNo, email, phone }) => ({ name, branch, batch, regd_no: regdNo, email, phone });
  const body = req.body || {};
  const allowed = ['name', 'branch', 'batch', 'regd_no', 'email', 'phone'];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) throw badRequest(`Unknown field: ${unknown[0]}`);
  const r = cleanRecord({ ...pick(existing), ...body });
  try {
    const { rows: [rec] } = await query(
      `UPDATE college_records SET name = $2, branch = $3, batch = $4, regd_no = $5, email = $6, phone = $7, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, r.name, r.branch, r.batch, r.regd_no, r.email, r.phone],
    );
    await linkUsers();
    await audit(req, 'roster.update', rec.id);
    res.json({ record: rec });
  } catch (err) {
    if (err.code === '23505') throw conflict(duplicateMessage(err), 'DUPLICATE');
    throw err;
  }
}));

router.delete('/:id', validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  const { rowCount } = await query('DELETE FROM college_records WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Student not found');
  await audit(req, 'roster.delete', req.params.id);
  res.json({ ok: true });
}));

/* ───────────── CSV / XLSX import ───────────── */

const HEADER_ALIASES = {
  name: ['name', 'studentname', 'fullname', 'student', 'nameofstudent', 'candidatename'],
  branch: ['branch', 'department', 'dept', 'stream', 'course', 'discipline', 'programme', 'program'],
  batch: ['batch', 'year', 'session', 'admissionyear', 'passingyear', 'academicyear', 'batchyear'],
  regd_no: ['regdno', 'regno', 'regd', 'registrationno', 'registrationnumber', 'registration', 'regnumber', 'rollno', 'roll', 'rollnumber', 'enrollmentno', 'enrolmentno', 'enrollmentnumber', 'universityregno'],
  email: ['email', 'emailid', 'mail', 'emailaddress', 'collegeemail', 'mailid', 'officialemail'],
  phone: ['phone', 'mobile', 'phoneno', 'mobileno', 'contact', 'contactno', 'phonenumber', 'mobilenumber', 'contactnumber', 'whatsapp'],
};
const normHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    const n = normHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] === undefined && aliases.includes(n)) map[field] = idx;
    }
  });
  return map;
}

const cellText = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }
  return String(v);
};

async function readSheet(file) {
  if (/\.xlsx$/i.test(file.originalname)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file.path);
    const ws = wb.worksheets[0];
    if (!ws) throw badRequest('The spreadsheet has no sheets');
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      for (let i = 1; i <= Math.max(ws.columnCount, row.cellCount); i += 1) vals.push(cellText(row.getCell(i).value).trim());
      rows.push(vals);
    });
    return rows;
  }
  const buf = await fs.readFile(file.path);
  return parseCsv(buf, { bom: true, skip_empty_lines: true, relax_column_count: true, trim: true });
}

async function analyse(file) {
  const raw = await readSheet(file);
  if (raw.length < 2) throw badRequest('The file needs a header row and at least one student');
  if (raw.length - 1 > MAX_ROWS) throw badRequest(`A single import can contain up to ${MAX_ROWS} students`);
  const map = mapHeaders(raw[0]);
  const missing = ['name', 'regd_no'].filter((f) => map[f] === undefined);
  if (missing.length) {
    throw badRequest(`Couldn't find column${missing.length > 1 ? 's' : ''} for ${missing.map((m) => (m === 'regd_no' ? 'registration number' : m)).join(' and ')}. Use headers like: name, branch, batch, regd_no, email, phone.`, 'MISSING_COLUMNS');
  }

  const seen = { regd_no: new Map(), email: new Map(), phone: new Map() };
  const rows = raw.slice(1).map((vals, i) => {
    const line = i + 2;
    const input = Object.fromEntries(Object.entries(map).map(([f, idx]) => [f, vals[idx] ?? '']));
    const row = { line, data: input, errors: [], action: 'new' };
    try {
      row.data = cleanRecord(input);
    } catch (err) {
      row.errors.push(err.issues ? err.issues[0].message : err.message);
      return row;
    }
    for (const key of ['regd_no', 'email', 'phone']) {
      const v = row.data[key];
      if (!v) continue;
      if (seen[key].has(v)) row.errors.push(`Duplicate ${key === 'regd_no' ? 'registration number' : key} (also on line ${seen[key].get(v)})`);
      else seen[key].set(v, line);
    }
    return row;
  });

  // Compare with existing roster
  const valid = rows.filter((r) => !r.errors.length);
  if (valid.length) {
    const regds = valid.map((r) => r.data.regd_no);
    const emails = valid.map((r) => r.data.email).filter(Boolean);
    const phones = valid.map((r) => r.data.phone).filter(Boolean);
    const { rows: existing } = await query(
      'SELECT regd_no, email, phone FROM college_records WHERE regd_no = ANY($1) OR email = ANY($2) OR phone = ANY($3)',
      [regds, emails, phones],
    );
    const byRegd = new Map(existing.map((e) => [e.regd_no, e]));
    const emailOwner = new Map(existing.filter((e) => e.email).map((e) => [e.email, e.regd_no]));
    const phoneOwner = new Map(existing.filter((e) => e.phone).map((e) => [e.phone, e.regd_no]));
    for (const r of valid) {
      if (byRegd.has(r.data.regd_no)) r.action = 'update';
      if (r.data.email && emailOwner.has(r.data.email) && emailOwner.get(r.data.email) !== r.data.regd_no) r.errors.push(`Email already belongs to ${emailOwner.get(r.data.email)}`);
      if (r.data.phone && phoneOwner.has(r.data.phone) && phoneOwner.get(r.data.phone) !== r.data.regd_no) r.errors.push(`Phone already belongs to ${phoneOwner.get(r.data.phone)}`);
    }
  }
  rows.forEach((r) => { if (r.errors.length) r.action = 'skip'; });
  return {
    columns: Object.keys(map),
    rows,
    summary: {
      total: rows.length,
      new: rows.filter((r) => r.action === 'new').length,
      update: rows.filter((r) => r.action === 'update').length,
      skip: rows.filter((r) => r.action === 'skip').length,
    },
  };
}

router.post('/import/preview', importLimiter, sheetUpload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Choose a .csv or .xlsx file to import');
  try {
    res.json(await analyse(req.file));
  } finally {
    await safeUnlink(req.file.path);
  }
}));

router.post('/import/commit', importLimiter, sheetUpload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Choose a .csv or .xlsx file to import');
  let result;
  try {
    result = await analyse(req.file);
  } finally {
    await safeUnlink(req.file.path);
  }
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  const failed = [];
  try {
    await client.query('BEGIN');
    for (const r of result.rows) {
      if (r.action === 'skip') continue;
      const d = r.data;
      // eslint-disable-next-line no-await-in-loop
      await client.query('SAVEPOINT row');
      try {
        // eslint-disable-next-line no-await-in-loop
        const { rows: [x] } = await client.query(
          `INSERT INTO college_records (name, branch, batch, regd_no, email, phone)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (regd_no) DO UPDATE SET
             name = EXCLUDED.name,
             branch = COALESCE(EXCLUDED.branch, college_records.branch),
             batch = COALESCE(EXCLUDED.batch, college_records.batch),
             email = COALESCE(EXCLUDED.email, college_records.email),
             phone = COALESCE(EXCLUDED.phone, college_records.phone),
             updated_at = now()
           RETURNING (xmax = 0) AS inserted`,
          [d.name, d.branch, d.batch, d.regd_no, d.email, d.phone],
        );
        if (x.inserted) inserted += 1; else updated += 1;
        // eslint-disable-next-line no-await-in-loop
        await client.query('RELEASE SAVEPOINT row');
      } catch (err) {
        // eslint-disable-next-line no-await-in-loop
        await client.query('ROLLBACK TO SAVEPOINT row');
        failed.push({ line: r.line, error: err.code === '23505' ? duplicateMessage(err) : err.message });
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await linkUsers();
  const skipped = result.rows.filter((r) => r.action === 'skip').map((r) => ({ line: r.line, error: r.errors.join('; ') }));
  await audit(req, 'roster.import', null, { inserted, updated, skipped: skipped.length + failed.length });
  res.json({ inserted, updated, skipped: [...skipped, ...failed] });
}));

export default router;
