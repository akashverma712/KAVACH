import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { query, tx } from '../db/pool.js';
import { hit } from '../middleware/rateLimit.js';
import { AppError, badRequest, tooMany } from '../utils/errors.js';
import { maskEmail, maskPhone } from '../utils/phone.js';
import { otpEmailHtml, sendMail } from './mail.service.js';
import { sendSms } from './sms.service.js';

const SESSION_MINUTES = 15;
const OTP_GLOBAL_HOURLY = Number.parseInt(process.env.OTP_GLOBAL_HOURLY_LIMIT || '1000', 10);

const hashCode = (otpId, code) => crypto.createHmac('sha256', env.jwtSecret).update(`${otpId}:${code}`).digest('hex');

const safeEqual = (a, b) => {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export function describeChannels(destinations) {
  const out = [];
  if (destinations.email) out.push({ type: 'email', masked: maskEmail(destinations.email) });
  if (destinations.phone) out.push({ type: 'phone', masked: maskPhone(destinations.phone) });
  return out;
}

export async function createOtpSession({ purpose, userId = null, adminId = null, destinations, payload = {}, ip }) {
  const { rows } = await query(
    `INSERT INTO otps (purpose, user_id, admin_id, destinations, payload, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(mins => $7))
     RETURNING id`,
    [purpose, userId, adminId, JSON.stringify(destinations), JSON.stringify(payload), ip, SESSION_MINUTES],
  );
  return rows[0].id;
}

const purposeText = {
  register: { heading: 'Verify your Kavach account', sms: 'verification code' },
  login: { heading: 'Your Kavach sign-in code', sms: 'sign-in code' },
  reset: { heading: 'Reset your Kavach password', sms: 'password reset code' },
  admin_login: { heading: 'Kavach admin sign-in code', sms: 'admin sign-in code' },
};

/** Generate a fresh code for the session and deliver it on the chosen channel. */
export async function sendOtp(otpId, channel, { purposes } = {}) {
  if (!['email', 'phone'].includes(channel)) throw badRequest('Choose email or phone to receive your code');

  const prepared = await tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM otps WHERE id = $1 FOR UPDATE', [otpId]);
    const s = rows[0];
    if (!s || s.consumed_at || new Date(s.expires_at) < new Date() || (purposes && !purposes.includes(s.purpose))) {
      throw new AppError(410, 'This verification session has expired. Please start again.', 'OTP_SESSION_EXPIRED');
    }
    const destination = s.destinations?.[channel];
    if (!destination) throw badRequest(`No ${channel === 'email' ? 'email address' : 'phone number'} is available for this account`);

    if (s.last_sent_at) {
      const wait = Math.ceil((new Date(s.last_sent_at).getTime() + env.otp.resendCooldownSeconds * 1000 - Date.now()) / 1000);
      if (wait > 0) throw tooMany(`Please wait ${wait}s before requesting another code`, 'OTP_COOLDOWN', { retryAfter: wait });
    }
    if (s.sends >= env.otp.maxSends) throw tooMany('Too many codes requested. Please start again later.', 'OTP_SEND_LIMIT');

    // Same destination from any IP: max 5 codes / 15 min.  All destinations: global hourly ceiling (SMS-pumping guard).
    const perDest = await hit(`otp-dest:${channel}:${destination}`, 15 * 60_000);
    if (perDest.totalHits > 5) throw tooMany('Too many codes sent to this address. Try again in 15 minutes.', 'OTP_DEST_LIMIT');
    const global = await hit('otp-global', 60 * 60_000);
    if (global.totalHits > OTP_GLOBAL_HOURLY) throw tooMany('Verification is temporarily busy. Try again shortly.', 'OTP_GLOBAL_LIMIT');

    const code = String(crypto.randomInt(100000, 1000000));
    await c.query(
      `UPDATE otps SET channel = $2, code_hash = $3, attempts = 0, sends = sends + 1, last_sent_at = now(),
              code_expires_at = now() + make_interval(secs => $4)
        WHERE id = $1`,
      [otpId, channel, hashCode(otpId, code), env.otp.ttlSeconds],
    );
    return { code, destination, purpose: s.purpose };
  });

  const minutes = Math.round(env.otp.ttlSeconds / 60);
  const text = purposeText[prepared.purpose];
  if (channel === 'email') {
    await sendMail({
      to: prepared.destination,
      subject: `${prepared.code} is your ${text.sms}`,
      text: `${text.heading}\n\nYour code is ${prepared.code}. It expires in ${minutes} minutes.\nNever share this code with anyone.`,
      html: otpEmailHtml({ heading: text.heading, code: prepared.code, minutes }),
      consoleLines: [`Purpose: ${prepared.purpose}`, `OTP CODE: ${prepared.code}`, `Expires in ${minutes} minutes`],
    });
  } else {
    await sendSms({
      to: prepared.destination,
      kind: `OTP SMS (${prepared.purpose})`,
      consoleLines: [`OTP CODE: ${prepared.code}`],
      body: `${prepared.code} is your Kavach ${text.sms}. Valid for ${minutes} min. Do not share it with anyone. - BIT Sindri`,
    });
  }

  return {
    channel,
    masked: channel === 'email' ? maskEmail(prepared.destination) : maskPhone(prepared.destination),
    expiresIn: env.otp.ttlSeconds,
    resendIn: env.otp.resendCooldownSeconds,
  };
}

/** Verify a code. On success the session is consumed and returned. */
export async function verifyOtp(otpId, code, purpose) {
  const result = await tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM otps WHERE id = $1 FOR UPDATE', [otpId]);
    const s = rows[0];
    if (!s || s.purpose !== purpose || s.consumed_at || new Date(s.expires_at) < new Date()) {
      return { error: new AppError(410, 'This verification session has expired. Please start again.', 'OTP_SESSION_EXPIRED') };
    }

    // ── Dev bypass: accept hardcoded OTP for the dev bypass phone/email ──
    if (env.devBypass && String(code) === env.devBypass.otp) {
      const dest = s.destinations || {};
      const isDevPhone = dest.phone && dest.phone === env.devBypass.phone;
      const isDevEmail = dest.email && dest.email === env.devBypass.email;
      if (isDevPhone || isDevEmail) {
        await c.query('UPDATE otps SET consumed_at = now() WHERE id = $1', [otpId]);
        console.log(`[DEV BYPASS] OTP verified for ${isDevPhone ? 'phone ' + dest.phone : 'email ' + dest.email} (purpose: ${purpose})`);
        return { session: s };
      }
    }

    if (!s.code_hash) return { error: badRequest('Request a code first', 'OTP_NOT_SENT') };
    if (new Date(s.code_expires_at) < new Date()) return { error: badRequest('This code has expired. Request a new one.', 'OTP_EXPIRED') };
    if (s.attempts >= env.otp.maxAttempts) return { error: tooMany('Too many incorrect attempts. Request a new code.', 'OTP_LOCKED') };

    if (!/^\d{6}$/.test(String(code)) || !safeEqual(s.code_hash, hashCode(otpId, String(code)))) {
      const attempts = s.attempts + 1;
      await c.query('UPDATE otps SET attempts = $2 WHERE id = $1', [otpId, attempts]);
      const left = env.otp.maxAttempts - attempts;
      return {
        error: left > 0
          ? badRequest(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`, 'OTP_INVALID')
          : tooMany('Too many incorrect attempts. Request a new code.', 'OTP_LOCKED'),
      };
    }
    await c.query('UPDATE otps SET consumed_at = now() WHERE id = $1', [otpId]);
    return { session: s };
  });
  if (result.error) throw result.error;
  return result.session;
}

export function startOtpJanitor() {
  const t = setInterval(() => {
    query(`DELETE FROM otps WHERE expires_at < now() - interval '1 day'`).catch(() => {});
  }, 60 * 60_000);
  t.unref();
}
