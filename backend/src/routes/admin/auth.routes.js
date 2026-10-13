import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { requireAdmin, signAdminToken } from '../../middleware/auth.js';
import { authIdentifierLimiter, authIpLimiter, otpVerifyLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/activity.service.js';
import { createOtpSession, sendOtp, verifyOtp } from '../../services/otp.service.js';
import { env } from '../../config/env.js';
import { ah, unauthorized } from '../../utils/errors.js';
import { maskEmail, normalizeEmail } from '../../utils/phone.js';
import { otpCodeSchema, uuid } from '../schemas.js';

const router = Router();

router.post('/start', authIpLimiter, authIdentifierLimiter, validate(z.object({
  email: z.string().trim().min(3).max(254),
}).strict()), ah(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { rows: [admin] } = email ? await query('SELECT id, email FROM admins WHERE email = $1', [email]) : { rows: [] };

  // ── Dev bypass: auto-create admin for dev email ──────────────
  if (env.devBypass && email && email === env.devBypass.email && !admin) {
    const { rows: [devAdmin] } = await query(
      `INSERT INTO admins (name, email, phone) VALUES ('Dev Admin', $1, $2)
       ON CONFLICT (email) DO UPDATE SET name = 'Dev Admin'
       RETURNING id, email`,
      [env.devBypass.email, env.devBypass.phone],
    );
    const otpId = await createOtpSession({ purpose: 'admin_login', adminId: devAdmin.id, destinations: { email: devAdmin.email }, ip: req.ip });
    console.log(`[DEV BYPASS] Admin login started for dev email ${email} — use OTP "${env.devBypass.otp}" to verify`);
    return res.json({
      otp_id: otpId,
      delivery: { channel: 'email', masked: maskEmail(devAdmin.email), expiresIn: env.otp.ttlSeconds, resendIn: env.otp.resendCooldownSeconds },
    });
  }

  // Same response shape whether or not the email is an admin, so admin emails can't be discovered.
  if (!admin) {
    return res.json({
      otp_id: crypto.randomUUID(),
      delivery: { channel: 'email', masked: email ? maskEmail(email) : 'your email', expiresIn: env.otp.ttlSeconds, resendIn: env.otp.resendCooldownSeconds },
    });
  }

  // Dev bypass for existing admin with dev email
  if (env.devBypass && email && email === env.devBypass.email) {
    const otpId = await createOtpSession({ purpose: 'admin_login', adminId: admin.id, destinations: { email: admin.email }, ip: req.ip });
    console.log(`[DEV BYPASS] Admin login started for dev email ${email} — use OTP "${env.devBypass.otp}" to verify`);
    return res.json({
      otp_id: otpId,
      delivery: { channel: 'email', masked: maskEmail(admin.email), expiresIn: env.otp.ttlSeconds, resendIn: env.otp.resendCooldownSeconds },
    });
  }

  const otpId = await createOtpSession({ purpose: 'admin_login', adminId: admin.id, destinations: { email: admin.email }, ip: req.ip });
  const delivery = await sendOtp(otpId, 'email', { purposes: ['admin_login'] });
  res.json({ otp_id: otpId, delivery });
}));

router.post('/resend', authIpLimiter, validate(z.object({ otp_id: uuid }).strict()), ah(async (req, res) => {
  const delivery = await sendOtp(req.body.otp_id, 'email', { purposes: ['admin_login'] });
  res.json({ delivery });
}));

router.post('/verify', otpVerifyLimiter, validate(z.object({ otp_id: uuid, code: otpCodeSchema }).strict()), ah(async (req, res) => {
  const { rows: exists } = await query('SELECT 1 FROM otps WHERE id = $1', [req.body.otp_id]);
  if (!exists.length) throw unauthorized('Incorrect code or expired session. Start again.', 'OTP_INVALID');
  const session = await verifyOtp(req.body.otp_id, req.body.code, 'admin_login');
  const { rows: [admin] } = await query('UPDATE admins SET last_login_at = now() WHERE id = $1 RETURNING id, name, email, phone', [session.admin_id]);
  if (!admin) throw unauthorized('Admin account not found');
  req.admin = admin;
  await audit(req, 'admin.login', admin.id);
  res.json({ token: signAdminToken(admin), admin });
}));

router.get('/me', requireAdmin, (req, res) => res.json({ admin: req.admin }));

export default router;
