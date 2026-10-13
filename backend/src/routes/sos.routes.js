import { Router } from 'express';
import { z } from 'zod';
import { isTwilioConfigured } from '../config/env.js';
import { query } from '../db/pool.js';
import { sosIpLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../services/activity.service.js';
import {
  ACTIVE_HOURS,
  addLocation,
  createSos,
  getStudentSos,
  hourlyUsage,
  markSafe,
} from '../services/sos.service.js';
import { ah } from '../utils/errors.js';
import { uuid } from './schemas.js';

const router = Router();

router.get('/status', ah(async (req, res) => {
  const [u, { rows: [active] }, { rows: recent }] = await Promise.all([
    hourlyUsage(req.user.id),
    query(
      `SELECT s.id, s.status, s.trigger, s.recipients, s.lat, s.lng, s.accuracy,
              s.last_lat, s.last_lng, s.last_accuracy, s.last_location_at,
              s.acknowledged_at, s.admin_note, s.resolved_at, s.created_at,
              a.name AS acknowledged_by_name
         FROM sos_events s
         LEFT JOIN admins a ON a.id = s.acknowledged_by
        WHERE s.user_id = $1 AND s.resolved_at IS NULL AND s.created_at > now() - make_interval(hours => $2)
        ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.id, ACTIVE_HOURS],
    ),
    query(
      `SELECT id, lat, lng, accuracy, trigger, status, recipients, acknowledged_at, resolved_at, created_at
         FROM sos_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.user.id],
    ),
  ]);

  res.json({
    ...u,
    active: active || null,
    delivery_mode: isTwilioConfigured() ? 'sms' : 'console',
    recent,
  });
}));

const sosSchema = z.object({
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().min(0).max(1_000_000).optional().nullable(),
  trigger: z.enum(['button', 'voice', 'offline_sync']).default('button'),
  client_id: z.string().trim().max(100).optional().nullable(),
  client_time: z.string().datetime().optional().nullable(),
  transcript: z.string().trim().max(500).optional().nullable(),
}).strict();

router.post('/', sosIpLimiter, validate(sosSchema), ah(async (req, res) => {
  const { duplicate, sos } = await createSos(req.user, req.body);
  await audit(req, 'sos.sent', sos.id, { trigger: req.body.trigger, status: sos.status, duplicate });
  const usage = await hourlyUsage(req.user.id);

  res.status(duplicate ? 200 : 201).json({
    ...sos,
    duplicate,
    delivery_mode: isTwilioConfigured() ? 'sms' : 'console',
    ...usage,
  });
}));

router.get('/:id', validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  const sos = await getStudentSos(req.user.id, req.params.id);
  res.json(sos);
}));

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1_000_000).optional().nullable(),
}).strict();

router.post('/:id/location', validate(z.object({ id: uuid }), 'params'), validate(locationSchema), ah(async (req, res) => {
  const result = await addLocation(req.user.id, req.params.id, req.body);
  res.json(result);
}));

const safeSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

router.post('/:id/safe', validate(z.object({ id: uuid }), 'params'), validate(safeSchema), ah(async (req, res) => {
  await markSafe(req.user, req.params.id, req.body.note);
  await audit(req, 'sos.safe', req.params.id);
  res.json({ ok: true });
}));

export default router;
