import { env } from '../config/env.js';

/**
 * Normalise an Indian mobile number to its 10-digit form.
 * Accepts "+91 98765-43210", "09876543210", "919876543210", "9876543210".
 * Returns null when the input is not a valid Indian mobile number.
 */
export function normalizePhone(input) {
  if (input === undefined || input === null) return null;
  let digits = String(input).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Normalise any contact number: Indian 10-digit form, or a full international number kept as +<digits>. */
export function normalizeContactPhone(input) {
  const indian = normalizePhone(input);
  if (indian) return indian;
  const raw = String(input ?? '').trim();
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  }
  return null;
}

/** Convert a stored number to E.164 for Twilio. */
export function toE164(phone) {
  if (!phone) return null;
  if (String(phone).startsWith('+')) return phone;
  const cc = env.defaultCountryCode.startsWith('+') ? env.defaultCountryCode : `+${env.defaultCountryCode}`;
  return `${cc}${phone}`;
}

export function normalizeEmail(input) {
  if (!input) return null;
  const e = String(input).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

export function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = email.split('@');
  const visible = user.length <= 2 ? user[0] : user.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(3, user.length - visible.length - 1))}${user.length > 3 ? user.slice(-1) : ''}@${domain}`;
}

export function maskPhone(phone) {
  if (!phone) return null;
  const s = String(phone);
  return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}
