/**
 * SOS core logic, shared by the student and admin routes.
 *
 * Order of operations when a student sends an SOS:
 *   1. Reserve a slot (advisory lock + hourly count) and insert the event as 'sending'
 *   2. Broadcast 'sos.created' to admins immediately (before any SMS is attempted)
 *   3. Send SMS to every contact + campus admin in parallel, each with a timeout
 *   4. Store delivery results, broadcast 'sos.updated', email the admin
 */
import { env } from '../config/env.js';
import { query, tx } from '../db/pool.js';
import { AppError, notFound, tooMany } from '../utils/errors.js';
import { maskPhone } from '../utils/phone.js';
import { notify } from './activity.service.js';
import { alertEmailHtml, sendMail } from './mail.service.js';
import { publish } from './realtime.service.js';
import { getAdminEmergencyContact } from './settings.service.js';
import { sendSms } from './sms.service.js';

export const ACTIVE_HOURS = 2; // live location is accepted for this long after an SOS
const SMS_TIMEOUT_MS = 15_000;

export const istTime = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;

/** Columns admins see for an alert (one row, small enough for a NOTIFY payload). */
const ADMIN_SELECT = `
  s.id, s.user_id, s.lat, s.lng, s.accuracy, s.trigger, s.status, s.recipients, s.transcript,
  s.last_lat, s.last_lng, s.last_accuracy, s.last_location_at,
  s.acknowledged_at, s.admin_note, s.resolved_at, s.resolved_by, s.resolution_note, s.created_at,
  u.name, u.regd_no, u.phone, u.email, u.branch, u.batch,
  a.name AS acknowledged_by_name,
  (SELECT count(*)::int FROM sos_locations l WHERE l.sos_id = s.id) AS location_count`;

export async function loadAdminSos(id) {
  const { rows: [row] } = await query(
    `SELECT ${ADMIN_SELECT} FROM sos_events s JOIN users u ON u.id = s.user_id
       LEFT JOIN admins a ON a.id = s.acknowledged_by WHERE s.id = $1`,
    [id],
  );
  return row || null;
}

export async function listAdminSos({ where = 'TRUE', params = [], limit = 25, offset = 0 }) {
  const { rows } = await query(
    `SELECT ${ADMIN_SELECT} FROM sos_events s JOIN users u ON u.id = s.user_id
       LEFT JOIN admins a ON a.id = s.acknowledged_by
      WHERE ${where} ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return rows;
}

async function broadcast(type, id) {
  const sos = await loadAdminSos(id);
  if (sos) await publish(type, { sos });
  return sos;
}

export async function hourlyUsage(userId) {
  const { rows: [r] } = await query(
    `SELECT count(*)::int AS used, min(created_at) AS oldest
       FROM sos_events WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [userId],
  );
  return {
    max: env.sosMaxPerHour,
    used: r.used,
    remaining: Math.max(0, env.sosMaxPerHour - r.used),
    resets_at: r.oldest ? new Date(new Date(r.oldest).getTime() + 3_600_000).toISOString() : null,
  };
}

async function recipientsFor(userId) {
  const [admin, { rows: contacts }] = await Promise.all([
    getAdminEmergencyContact(),
    query('SELECT name, phone FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at', [userId]),
  ]);
  const seen = new Set();
  return [...contacts, ...(admin.phone ? [{ name: admin.name, phone: admin.phone }] : [])]
    .filter((r) => (seen.has(r.phone) ? false : seen.add(r.phone)));
}

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve({ delivered: false, via: 'timeout', error: 'Timed out' }), ms)),
]);

async function deliverAll(recipients, body, kind) {
  return Promise.all(recipients.map(async (r) => {
    let out;
    try {
      out = await withTimeout(sendSms({ to: r.phone, body, kind, throwOnFail: false }), SMS_TIMEOUT_MS);
    } catch (err) {
      out = { delivered: false, via: 'error', error: err.message };
    }
    return { name: r.name, phone: maskPhone(r.phone), delivered: Boolean(out.delivered), via: out.via, ...(out.error ? { error: 'Delivery failed' } : {}) };
  }));
}

function buildMessage(u, { lat, lng, accuracy, trigger, when }) {
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
  return [
    `SOS ALERT from ${u.name}${u.regd_no ? ` (${u.regd_no})` : ''}${u.branch ? `, ${u.branch}` : ''}.`,
    trigger === 'voice' ? 'Needs urgent help (voice-activated).' : 'Needs urgent help.',
    hasLoc ? `Location: ${mapsLink(lat, lng)}` : 'Location: unavailable (GPS off)',
    hasLoc && accuracy ? `Accuracy: ~${Math.round(accuracy)} m` : null,
    u.phone ? `Call: ${u.phone}` : null,
    `${trigger === 'offline_sync' ? 'Triggered offline at' : 'Time'}: ${istTime(when)}`,
    'Live updates: campus admin is notified.',
    '- Kavach, BIT Sindri',
  ].filter(Boolean).join('\n');
}

/** Student → create (or idempotently return) an SOS. */
export async function createSos(user, input) {
  const { lat, lng, accuracy, trigger, client_id: clientId, client_time: clientTime, transcript } = input;
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);

  if (clientId) {
    const { rows: [dup] } = await query('SELECT id FROM sos_events WHERE user_id = $1 AND client_id = $2', [user.id, clientId]);
    if (dup) return { duplicate: true, sos: await loadAdminSos(dup.id) };
  }

  const when = clientTime && trigger === 'offline_sync' ? new Date(clientTime) : new Date();
  const message = buildMessage(user, { lat, lng, accuracy, trigger, when });

  const eventId = await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sos:${user.id}`]);
    const { rows: [r] } = await c.query(
      `SELECT count(*)::int AS used, min(created_at) AS oldest
         FROM sos_events WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [user.id],
    );
    if (r.used >= env.sosMaxPerHour) {
      throw tooMany(
        `You've reached the limit of ${env.sosMaxPerHour} SOS alerts per hour. If you are in danger, call 112 now.`,
        'SOS_LIMIT',
        { resets_at: new Date(new Date(r.oldest).getTime() + 3_600_000).toISOString() },
      );
    }
    const { rows: [ev] } = await c.query(
      `INSERT INTO sos_events (user_id, lat, lng, accuracy, trigger, message, status, client_id, transcript,
                               last_lat, last_lng, last_accuracy, last_location_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sending', $7, $8, $2, $3, $4, CASE WHEN $2::float8 IS NULL THEN NULL ELSE now() END)
       ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [user.id, hasLoc ? lat : null, hasLoc ? lng : null, hasLoc ? (accuracy ?? null) : null, trigger, message, clientId || null, transcript || null],
    );
    if (!ev) return null; // a parallel retry with the same client_id won the race
    if (hasLoc) await c.query('INSERT INTO sos_locations (sos_id, lat, lng, accuracy) VALUES ($1, $2, $3, $4)', [ev.id, lat, lng, accuracy ?? null]);
    return ev.id;
  });

  if (!eventId) {
    const { rows: [dup] } = await query('SELECT id FROM sos_events WHERE user_id = $1 AND client_id = $2', [user.id, clientId]);
    return { duplicate: true, sos: await loadAdminSos(dup.id) };
  }

  // 1) Admins see it right away
  await broadcast('sos.created', eventId).catch((err) => console.error('SOS broadcast failed', err));

  // 2) SMS to everyone
  const recipients = await recipientsFor(user.id);
  const results = await deliverAll(recipients, message, trigger === 'voice' ? 'SOS ALERT SMS (voice)' : 'SOS ALERT SMS');
  const failed = results.filter((x) => x.error).length;
  const status = recipients.length === 0 || failed === recipients.length ? 'failed' : failed ? 'partial' : 'sent';
  await query('UPDATE sos_events SET recipients = $2, status = $3 WHERE id = $1', [eventId, JSON.stringify(results), status]);
  const sos = await broadcast('sos.updated', eventId);

  // 3) Email copy to the admin (never blocks the response)
  query('SELECT email FROM admins ORDER BY created_at LIMIT 1').then(({ rows }) => rows[0] && sendMail({
    to: rows[0].email,
    subject: `SOS: ${user.name}${user.regd_no ? ` (${user.regd_no})` : ''} needs help`,
    text: message,
    html: alertEmailHtml({
      heading: `SOS from ${user.name}`,
      lines: [user.regd_no && `Regd. no: ${user.regd_no}`, user.branch && `Branch: ${user.branch}`, user.phone && `Phone: ${user.phone}`, `Time: ${istTime(when)}`, `Trigger: ${trigger}`, transcript && `Heard: “${transcript}”`].filter(Boolean),
      link: hasLoc ? mapsLink(lat, lng) : null,
    }),
    consoleLines: [`SOS from ${user.name}`, hasLoc ? mapsLink(lat, lng) : 'Location unavailable', `Trigger: ${trigger}`],
  })).catch((err) => console.error('SOS admin email failed', err.message));

  return { duplicate: false, sos };
}

/** Student-facing view of one of their own alerts. */
export async function getStudentSos(userId, id) {
  const { rows: [s] } = await query(
    `SELECT s.id, s.status, s.trigger, s.recipients, s.lat, s.lng, s.accuracy, s.last_lat, s.last_lng, s.last_accuracy, s.last_location_at,
            s.acknowledged_at, s.admin_note, s.resolved_at, s.resolved_by, s.resolution_note, s.created_at,
            a.name AS acknowledged_by_name,
            (s.resolved_at IS NULL AND s.created_at > now() - make_interval(hours => $3)) AS active
       FROM sos_events s LEFT JOIN admins a ON a.id = s.acknowledged_by
      WHERE s.id = $1 AND s.user_id = $2`,
    [id, userId, ACTIVE_HOURS],
  );
  if (!s) throw notFound('Alert not found');
  return s;
}

export async function addLocation(userId, id, { lat, lng, accuracy }) {
  const { rows: [s] } = await query(
    `SELECT id, resolved_at, created_at, last_location_at FROM sos_events WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!s) throw notFound('Alert not found');
  if (s.resolved_at) throw new AppError(409, 'This alert has been closed', 'SOS_RESOLVED');
  if (new Date(s.created_at) < new Date(Date.now() - ACTIVE_HOURS * 3_600_000)) throw new AppError(410, 'Live location sharing has ended for this alert', 'SOS_EXPIRED');
  if (s.last_location_at && Date.now() - new Date(s.last_location_at).getTime() < 4000) return { throttled: true };

  await query('INSERT INTO sos_locations (sos_id, lat, lng, accuracy) VALUES ($1, $2, $3, $4)', [id, lat, lng, accuracy ?? null]);
  await query(
    `UPDATE sos_events SET last_lat = $2, last_lng = $3, last_accuracy = $4, last_location_at = now(),
            lat = COALESCE(lat, $2), lng = COALESCE(lng, $3), accuracy = COALESCE(accuracy, $4)
      WHERE id = $1`,
    [id, lat, lng, accuracy ?? null],
  );
  await publish('sos.location', { id, lat, lng, accuracy: accuracy ?? null, at: new Date().toISOString() });
  return { throttled: false };
}

export async function markSafe(user, id, note) {
  const { rows: [s] } = await query(
    `UPDATE sos_events SET resolved_at = now(), resolved_by = 'student', resolution_note = $3
      WHERE id = $1 AND user_id = $2 AND resolved_at IS NULL RETURNING id`,
    [id, user.id, note || null],
  );
  if (!s) throw notFound('No active alert to close');
  const recipients = await recipientsFor(user.id);
  const body = `UPDATE: ${user.name}${user.regd_no ? ` (${user.regd_no})` : ''} has marked themselves SAFE on Kavach at ${istTime(new Date())}.${note ? ` Note: ${note}` : ''}\n- Kavach, BIT Sindri`;
  deliverAll(recipients, body, 'SOS SAFE SMS').catch(() => {});
  await broadcast('sos.resolved', id);
}

export async function acknowledge(admin, id, note) {
  const { rows: [s] } = await query(
    `UPDATE sos_events SET acknowledged_at = COALESCE(acknowledged_at, now()), acknowledged_by = COALESCE(acknowledged_by, $2),
            admin_note = COALESCE($3, admin_note)
      WHERE id = $1 RETURNING id, user_id`,
    [id, admin.id, note || null],
  );
  if (!s) throw notFound('Alert not found');
  const { rows: [u] } = await query('SELECT phone FROM users WHERE id = $1', [s.user_id]);
  await notify(s.user_id, { title: 'The campus admin is responding to your SOS', body: note || 'Stay where you are if it is safe and keep your phone with you.', link: '/app/sos' });
  if (u?.phone) {
    sendSms({ to: u.phone, kind: 'SOS ACK SMS', throwOnFail: false, body: `Kavach: the campus admin has received your SOS and is responding.${note ? ` ${note}` : ''} Call 112 if you are in immediate danger.` }).catch(() => {});
  }
  return broadcast('sos.acknowledged', id);
}

export async function resolveByAdmin(admin, id, note) {
  const { rows: [s] } = await query(
    `UPDATE sos_events SET resolved_at = now(), resolved_by = 'admin', resolution_note = $2,
            acknowledged_at = COALESCE(acknowledged_at, now()), acknowledged_by = COALESCE(acknowledged_by, $3)
      WHERE id = $1 AND resolved_at IS NULL RETURNING id, user_id`,
    [id, note || null, admin.id],
  );
  if (!s) throw notFound('No open alert with that id');
  await notify(s.user_id, { title: 'Your SOS has been closed by the campus admin', body: note || null, link: '/app/sos' });
  return broadcast('sos.resolved', id);
}

export async function locationTrail(id) {
  const { rows } = await query('SELECT lat, lng, accuracy, created_at FROM sos_locations WHERE sos_id = $1 ORDER BY created_at LIMIT 2000', [id]);
  return rows;
}
