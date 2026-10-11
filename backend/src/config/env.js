import crypto from 'node:crypto';
import 'dotenv/config';

const int = (v, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : d;
};
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: int(process.env.PORT, 5000),
  clientOrigins: list(process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:5174'),
  trustProxy: int(process.env.TRUST_PROXY, 0),

  databaseUrl: process.env.DATABASE_URL || 'postgres://kavach:kavach_dev_password@localhost:5432/kavach',
  dbPoolMax: int(process.env.DB_POOL_MAX, 20),
  dbSsl: bool(process.env.DB_SSL, false),

  jwtSecret: process.env.JWT_SECRET || '',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),

  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || 'bitsindri.ac.in').toLowerCase().replace(/^@/, ''),
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '+91',

  admin: {
    email: (process.env.ADMIN_EMAIL || 'rockingav9876@gmail.com').toLowerCase().trim(),
    name: process.env.ADMIN_NAME || 'Campus Admin',
    phone: process.env.ADMIN_PHONE || '7479676602',
  },

  otp: {
    ttlSeconds: int(process.env.OTP_TTL_SECONDS, 300),
    resendCooldownSeconds: int(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
    maxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
    maxSends: 5,
  },

  sosMaxPerHour: int(process.env.SOS_MAX_PER_HOUR, 10),
  autoHideReportThreshold: int(process.env.AUTO_HIDE_REPORT_THRESHOLD, 5),

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: int(process.env.MAX_UPLOAD_MB, 8),
};

// Development convenience: if no secrets are configured, use random ones for this run
// (sessions reset on restart). Production refuses to start without real secrets.
if (!env.isProd) {
  if (!env.jwtSecret) { env.jwtSecret = crypto.randomBytes(48).toString('hex'); env.ephemeralSecrets = true; }
  if (!env.adminJwtSecret) { env.adminJwtSecret = crypto.randomBytes(48).toString('hex'); env.ephemeralSecrets = true; }
}

/*
 * Delivery credentials are read lazily (at send time) so filling them in .env
 * switches from "print to terminal" to real delivery without touching code.
 */
export const smtpConfig = () => ({
  host: (process.env.SMTP_HOST || '').trim(),
  port: int(process.env.SMTP_PORT, 587),
  user: (process.env.SMTP_USER || '').trim(),
  pass: (process.env.SMTP_PASS || '').trim(),
  from: (process.env.MAIL_FROM || '').trim() || (process.env.SMTP_USER || '').trim() || 'no-reply@localhost',
});
export const isSmtpConfigured = () => {
  const c = smtpConfig();
  return Boolean(c.host && c.user && c.pass);
};

export const twilioConfig = () => ({
  sid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
  token: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
  from: (process.env.TWILIO_FROM_NUMBER || '').trim(),
});
export const isTwilioConfigured = () => {
  const c = twilioConfig();
  return Boolean(c.sid && c.token && c.from);
};

export const chatbotConfig = () => ({
  apiKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
  model: (process.env.CHATBOT_MODEL || 'claude-haiku-5-5').trim(),
});

const WEAK = ['', 'change-me', 'secret'];
export function assertSecureConfig(logger = console) {
  const problems = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (!env.adminJwtSecret || env.adminJwtSecret.length < 32) problems.push('ADMIN_JWT_SECRET must be at least 32 characters');
  if (env.jwtSecret && env.jwtSecret === env.adminJwtSecret) problems.push('JWT_SECRET and ADMIN_JWT_SECRET must differ');
  const looksDefault = [env.jwtSecret, env.adminJwtSecret].some((s) => WEAK.includes(s) || s.startsWith('change-me'));

  if (env.isProd && (!process.env.JWT_SECRET || !process.env.ADMIN_JWT_SECRET)) {
    throw new Error('JWT_SECRET and ADMIN_JWT_SECRET are required in production. Run `npm run setup` from the project root, or set them in backend/.env.');
  }
  if (env.isProd && (problems.length || looksDefault)) {
    throw new Error(`Insecure production configuration:\n - ${[...problems, looksDefault ? 'Replace the default JWT secrets' : null].filter(Boolean).join('\n - ')}`);
  }
  if (problems.length) {
    throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  }
  if (env.ephemeralSecrets) logger.warn('⚠  No backend/.env found — using temporary secrets (you will be signed out on restart). Run `npm run setup` from the project root.');
  else if (looksDefault) logger.warn('⚠  Using default JWT secrets — fine for local development, replace them before deploying.');
}
