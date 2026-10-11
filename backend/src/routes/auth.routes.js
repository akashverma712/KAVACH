import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { liftExpiredSuspension, moderationError, signUserToken } from '../middleware/auth.js';
import { authIdentifierLimiter, authIpLimiter, otpVerifyLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../services/activity.service.js';
import { createOtpSession, describeChannels, sendOtp, verifyOtp } from '../services/otp.service.js';
import crypto from 'node:crypto';
import { ah, badRequest, conflict, unauthorized } from '../utils/errors.js';
import { maskEmail, maskPhone, normalizeEmail, normalizePhone } from '../utils/phone.js';
import { nameSchema, otpCodeSchema, passwordSchema, uuid } from './schemas.js';

const router = Router();
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);

export const USER_FIELDS = `id, college_record_id, name, email, phone, branch, batch, regd_no, status, created_at`;
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  branch: u.branch,
  batch: u.batch,
  regd_no: u.regd_no,
  college_verified: Boolean(u.college_record_id),
  created_at: u.created_at,
});

/* ───────────────────────── Registration ───────────────────────── */

const registerSchema = z.object({
  name: nameSchema,
  email: z.string().trim().max(254).optional().default(''),
  phone: z.string().trim().max(20).optional().default(''),
  password: passwordSchema,
}).strict();

router.post('/register/start', authIpLimiter, authIdentifierLimiter, validate(registerSchema), ah(async (req, res) => {
  const { name, password } = req.body;
  const email = req.body.email ? normalizeEmail(req.body.email) : null;
  const phone = req.body.phone ? normalizePhone(req.body.phone) : null;
  if (req.body.email && !email) throw badRequest('Enter a valid email address', 'INVALID_EMAIL');
  if (req.body.phone && !phone) throw badRequest('Enter a valid 10-digit Indian mobile number', 'INVALID_PHONE');
  if (!email && !phone) throw badRequest('Enter your college email or the phone number registered with the college', 'CONTACT_REQUIRED');

  const domain = env.allowedEmailDomain;
  let byEmail = null;
  let byPhone = null;
  if (email) {
    ({ rows: [byEmail] } = await query('SELECT * FROM college_records WHERE email = $1', [email]));
    if (!byEmail && !email.endsWith(`@${domain}`)) {
      throw badRequest(`This email is not in college records. Use your @${domain} email or the email you gave the college.`, 'EMAIL_NOT_ALLOWED');
    }
  }
  if (phone) {
    ({ rows: [byPhone] } = await query('SELECT * FROM college_records WHERE phone = $1', [phone]));
    if (!byPhone) {
      throw badRequest('This phone number is not in college records. Use the number registered at admission, or sign up with your college email.', 'PHONE_NOT_ALLOWED');
    }
  }
  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    throw badRequest('This email and phone number belong to different students in college records.', 'CONTACT_MISMATCH');
  }
  const record = byEmail || byPhone || null;

  const { rows: existing } = await query(
    `SELECT 1 FROM users
      WHERE ($1::text IS NOT NULL AND email = $1)
         OR ($2::text IS NOT NULL AND phone = $2)
         OR ($3::uuid IS NOT NULL AND college_record_id = $3)
      LIMIT 1`,
    [email, phone, record?.id ?? null],
  );
  if (existing.length) throw conflict('An account already exists for these details. Sign in instead.', 'ACCOUNT_EXISTS');

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const destinations = Object.fromEntries(Object.entries({ email, phone }).filter(([, v]) => v));
  const otpId = await createOtpSession({
    purpose: 'register',
    destinations,
    payload: { name, email, phone, passwordHash, collegeRecordId: record?.id ?? null },
    ip: req.ip,
  });
  const channels = describeChannels(destinations);
  const delivery = channels.length === 1 ? await sendOtp(otpId, channels[0].type, { purposes: ['register'] }) : null;
  res.status(201).json({ otp_id: otpId, channels, delivery });
}));

const verifySchema = z.object({ otp_id: uuid, code: otpCodeSchema }).strict();

router.post('/register/verify', otpVerifyLimiter, validate(verifySchema), ah(async (req, res) => {
  const session = await verifyOtp(req.body.otp_id, req.body.code, 'register');
  const p = session.payload;
  let record = null;
  if (p.collegeRecordId) ({ rows: [record] } = await query('SELECT * FROM college_records WHERE id = $1', [p.collegeRecordId]));

  let user;
  try {
    ({ rows: [user] } = await query(
      `INSERT INTO users (college_record_id, name, email, phone, password_hash, branch, batch, regd_no, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING ${USER_FIELDS}, token_version`,
      [record?.id ?? null, record?.name || p.name, p.email, p.phone, p.passwordHash,
        record?.branch ?? null, record?.batch ?? null, record?.regd_no ?? null],
    ));
  } catch (err) {
    if (err.code === '23505') throw conflict('An account already exists for these details. Sign in instead.', 'ACCOUNT_EXISTS');
    throw err;
  }
  req.user = user;
  await audit(req, 'user.register', user.id);
  res.status(201).json({ token: signUserToken(user), user: publicUser(user) });
}));

/* ───────────────────────── Sign in ───────────────────────── */

const loginSchema = z.object({
  identifier: z.string().trim().min(2, 'Enter your name, email or phone number').max(254),
  password: z.string().min(1, 'Enter your password').max(72),
}).strict();

router.post('/login/start', authIpLimiter, authIdentifierLimiter, validate(loginSchema), ah(async (req, res) => {
  const { identifier, password } = req.body;
  const email = normalizeEmail(identifier);
  const phone = email ? null : normalizePhone(identifier);
  const fields = `${USER_FIELDS}, password_hash, suspended_until, moderation_reason, token_version`;

  let candidates;
  if (email) ({ rows: candidates } = await query(`SELECT ${fields} FROM users WHERE email = $1`, [email]));
  else if (phone) ({ rows: candidates } = await query(`SELECT ${fields} FROM users WHERE phone = $1`, [phone]));
  else ({ rows: candidates } = await query(`SELECT ${fields} FROM users WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 5`, [identifier]));

  let user = null;
  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(password, c.password_hash)) { user = c; break; }
  }
  if (!candidates.length) await bcrypt.compare(password, DUMMY_HASH); // equalise timing
  if (!user) throw unauthorized('Those details or the password are incorrect', 'INVALID_CREDENTIALS');

  user = await liftExpiredSuspension(user);
  const blocked = moderationError(user);
  if (blocked) throw blocked;

  const destinations = Object.fromEntries(Object.entries({ email: user.email, phone: user.phone }).filter(([, v]) => v));
  const otpId = await createOtpSession({ purpose: 'login', userId: user.id, destinations, ip: req.ip });
  const channels = describeChannels(destinations);
  const delivery = channels.length === 1 ? await sendOtp(otpId, channels[0].type, { purposes: ['login'] }) : null;
  res.json({ otp_id: otpId, channels, delivery });
}));

router.post('/login/verify', otpVerifyLimiter, validate(verifySchema), ah(async (req, res) => {
  const session = await verifyOtp(req.body.otp_id, req.body.code, 'login');
  let { rows: [user] } = await query(
    `SELECT ${USER_FIELDS}, suspended_until, moderation_reason, token_version FROM users WHERE id = $1`,
    [session.user_id],
  );
  if (!user) throw unauthorized('Account not found', 'ACCOUNT_NOT_FOUND');
  user = await liftExpiredSuspension(user);
  const blocked = moderationError(user);
  if (blocked) throw blocked;
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  req.user = user;
  await audit(req, 'user.login', user.id);
  res.json({ token: signUserToken(user), user: publicUser(user) });
}));

/* ───────────────────────── OTP delivery (choose channel / resend) ───────────────────────── */

const sendSchema = z.object({ otp_id: uuid, channel: z.enum(['email', 'phone']) }).strict();

router.post('/otp/send', authIpLimiter, validate(sendSchema), ah(async (req, res) => {
  const delivery = await sendOtp(req.body.otp_id, req.body.channel, { purposes: ['register', 'login'] });
  res.json({ delivery });
}));

/* ───────────────────────── Forgot password ───────────────────────── */

router.post('/password/forgot', authIpLimiter, authIdentifierLimiter, validate(z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone number').max(254),
}).strict()), ah(async (req, res) => {
  const email = normalizeEmail(req.body.identifier);
  const phone = email ? null : normalizePhone(req.body.identifier);
  if (!email && !phone) throw badRequest('Enter the email or phone number on your account', 'INVALID_IDENTIFIER');
  const channel = email ? 'email' : 'phone';
  const masked = email ? maskEmail(email) : maskPhone(phone);
  const { rows: [user] } = await query(`SELECT id FROM users WHERE ${email ? 'email' : 'phone'} = $1`, [email || phone]);

  // Identical response whether or not an account exists (no account discovery).
  if (!user) {
    return res.json({ otp_id: crypto.randomUUID(), delivery: { channel, masked, expiresIn: env.otp.ttlSeconds, resendIn: env.otp.resendCooldownSeconds } });
  }
  const otpId = await createOtpSession({ purpose: 'reset', userId: user.id, destinations: { [channel]: email || phone }, ip: req.ip });
  const delivery = await sendOtp(otpId, channel, { purposes: ['reset'] });
  res.json({ otp_id: otpId, delivery });
}));

router.post('/password/resend', authIpLimiter, validate(z.object({ otp_id: uuid }).strict()), ah(async (req, res) => {
  const { rows: [s] } = await query(`SELECT channel FROM otps WHERE id = $1 AND purpose = 'reset'`, [req.body.otp_id]);
  if (!s) return res.json({ delivery: null });
  res.json({ delivery: await sendOtp(req.body.otp_id, s.channel, { purposes: ['reset'] }) });
}));

router.post('/password/reset', otpVerifyLimiter, validate(z.object({
  otp_id: uuid, code: otpCodeSchema, new_password: passwordSchema,
}).strict()), ah(async (req, res) => {
  const session = await verifyOtp(req.body.otp_id, req.body.code, 'reset');
  const hash = await bcrypt.hash(req.body.new_password, env.bcryptRounds);
  let { rows: [user] } = await query(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now()
      WHERE id = $1 RETURNING ${USER_FIELDS}, suspended_until, moderation_reason, token_version`,
    [session.user_id, hash],
  );
  if (!user) throw unauthorized('Account not found', 'ACCOUNT_NOT_FOUND');
  req.user = user;
  await audit(req, 'user.password_reset', user.id);
  user = await liftExpiredSuspension(user);
  const blocked = moderationError(user);
  if (blocked) return res.json({ reset: true, token: null, message: blocked.message });
  res.json({ reset: true, token: signUserToken(user), user: publicUser(user) });
}));

/** Lets the registration form tell students early whether an identifier is accepted. */
router.post('/check-eligibility', authIpLimiter, validate(z.object({
  email: z.string().trim().max(254).optional(),
  phone: z.string().trim().max(20).optional(),
}).strict()), ah(async (req, res) => {
  const out = {};
  if (req.body.email) {
    const email = normalizeEmail(req.body.email);
    if (!email) out.email = { ok: false, message: 'Enter a valid email address' };
    else {
      const { rows } = await query('SELECT 1 FROM college_records WHERE email = $1', [email]);
      out.email = rows.length || email.endsWith(`@${env.allowedEmailDomain}`)
        ? { ok: true, message: rows.length ? 'Found in college records' : `College email (@${env.allowedEmailDomain})` }
        : { ok: false, message: `Use your @${env.allowedEmailDomain} email or the email registered with the college` };
    }
  }
  if (req.body.phone) {
    const phone = normalizePhone(req.body.phone);
    if (!phone) out.phone = { ok: false, message: 'Enter a valid 10-digit mobile number' };
    else {
      const { rows } = await query('SELECT 1 FROM college_records WHERE phone = $1', [phone]);
      out.phone = rows.length ? { ok: true, message: 'Found in college records' } : { ok: false, message: 'Not found in college records' };
    }
  }
  res.json(out);
}));

export default router;
