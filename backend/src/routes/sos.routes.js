import { Router } from 'express';
import { z } from 'zod';
import { env, isTwilioConfigured } from '../config/env.js';
import { query, tx } from '../db/pool.js';
import { sosIpLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../services/activity.service.js';
import { alertEmailHtml, sendMail } from '../services/mail.service.js';
import { getAdminEmergencyContact } from '../services/settings.service.js';
import { sendSms } from '../services/sms.service.js';
import { ah, tooMany } from '../utils/errors.js';
import { maskPhone } from '../utils/phone.js';

const router = Router();

async function usage(userId) {
  const { rows: [r] } = await query(
    `SELECT count(*)::int AS used, min(created_at) AS oldest
       FROM sos_events WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [userId],
  );
  const max = env.sosMaxPerHour;
  return {
    max,
    used: r.used,
    remaining: Math.max(0, max - r.used),
    resets_at: r.oldest ? new Date(new Date(r.oldest).getTime() + 3_600_000).toISOString() : null,
  };
}

router.get('/status', ah(async (req, res) => {
  const [u, { rows: recent }] = await Promise.all([
    usage(req.user.id),
    query(
      `SELECT id, lat, lng, accuracy, trigger, status, recipients, acknowledged_at, created_at
         FROM sos_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.user.id],
    ),
  ]);
  res.json({ ...u, delivery_mode: isTwilioConfigured() ? 'sms' : 'console', recent });
}));

const sosSchema = z.object({
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().min(0).max(1_000_000).optional().nullable(),
  trigger: z.enum(['button', 'voice', 'offline_sync']).default('button'),
  client_time: z.string().datetime().optional(),
}).strict();

const istTime = (d) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

router.post('/', sosIpLimiter, validate(sosSchema), ah(async (req, res) => {
  const u = req.user;
  const { lat, lng, accuracy, trigger, client_time: clientTime } = req.body;
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
  const mapsUrl = hasLoc ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` : null;
  const when = clientTime && trigger === 'offline_sync' ? new Date(clientTime) : new Date();

  const message = [
    `SOS ALERT from ${u.name}${u.regd_no ? ` (${u.regd_no})` : ''}${u.branch ? `, ${u.branch}` : ''}.`,
    'Needs urgent help.',
    mapsUrl ? `Location: ${mapsUrl}` : 'Location: unavailable (GPS off)',
    hasLoc && accuracy ? `Accuracy: ~${Math.round(accuracy)} m` : null,
    u.phone ? `Call: ${u.phone}` : null,
    `${trigger === 'offline_sync' ? 'Triggered offline at' : 'Time'}: ${istTime(when)}`,
    '- Kavach, BIT Sindri',
  ].filter(Boolean).join('\n');

  // Reserve a slot atomically so parallel taps cannot exceed the hourly limit.
  const eventId = await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sos:${u.id}`]);
    const { rows: [r] } = await c.query(
      `SELECT count(*)::int AS used, min(created_at) AS oldest
         FROM sos_events WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [u.id],
    );
    if (r.used >= env.sosMaxPerHour) {
      const resetsAt = new Date(new Date(r.oldest).getTime() + 3_600_000);
      throw tooMany(
        `You've reached the limit of ${env.sosMaxPerHour} SOS alerts per hour. If you are in danger, call 112 now.`,
        'SOS_LIMIT',
        { resets_at: resetsAt.toISOString() },
      );
    }
    const { rows: [ev] } = await c.query(
      `INSERT INTO sos_events (user_id, lat, lng, accuracy, trigger, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent') RETURNING id`,
      [u.id, hasLoc ? lat : null, hasLoc ? lng : null, accuracy ?? null, trigger, message],
    );
    return ev.id;
  });

  const [admin, { rows: contacts }] = await Promise.all([
    getAdminEmergencyContact(),
    query('SELECT name, phone FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at', [u.id]),
  ]);
  const seen = new Set();
  const recipients = [...contacts, ...(admin.phone ? [{ name: admin.name, phone: admin.phone }] : [])]
    .filter((r) => (seen.has(r.phone) ? false : seen.add(r.phone)));

  const results = await Promise.all(recipients.map(async (r) => {
    const out = await sendSms({ to: r.phone, body: message, kind: 'SOS ALERT SMS', throwOnFail: false });
    return { name: r.name, phone: maskPhone(r.phone), delivered: out.delivered, via: out.via, ...(out.error ? { error: 'Delivery failed' } : {}) };
  }));

  const failed = results.filter((r) => r.error).length;
  const status = recipients.length === 0 || failed === recipients.length ? 'failed' : failed ? 'partial' : 'sent';
  await query('UPDATE sos_events SET recipients = $2, status = $3 WHERE id = $1', [eventId, JSON.stringify(results), status]);

  // Email the campus admin as well (never blocks the response on failure).
  query('SELECT email FROM admins ORDER BY created_at LIMIT 1').then(({ rows }) => rows[0] && sendMail({
    to: rows[0].email,
    subject: `SOS: ${u.name}${u.regd_no ? ` (${u.regd_no})` : ''} needs help`,
    text: message,
    html: alertEmailHtml({
      heading: `SOS from ${u.name}`,
      lines: [u.regd_no ? `Regd. no: ${u.regd_no}` : '', u.branch ? `Branch: ${u.branch}` : '', u.phone ? `Phone: ${u.phone}` : '', `Time: ${istTime(when)}`, `Trigger: ${trigger}`].filter(Boolean),
      link: mapsUrl,
    }),
    consoleLines: [`SOS from ${u.name}`, mapsUrl || 'Location unavailable', `Trigger: ${trigger}`],
  })).catch((err) => console.error('SOS admin email failed', err.message));

  await audit(req, 'sos.sent', eventId, { trigger, status, recipients: results.length });
  const after = await usage(u.id);
  res.status(201).json({
    id: eventId,
    status,
    maps_url: mapsUrl,
    recipients: results,
    delivery_mode: isTwilioConfigured() ? 'sms' : 'console',
    ...after,
  });
}));

export default router;
