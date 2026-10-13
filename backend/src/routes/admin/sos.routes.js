import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/activity.service.js';
import { createSseStream } from '../../services/realtime.service.js';
import {
  ACTIVE_HOURS,
  acknowledge,
  listAdminSos,
  loadAdminSos,
  locationTrail,
  resolveByAdmin,
} from '../../services/sos.service.js';
import { ah, notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/paginate.js';
import { uuid } from '../schemas.js';

const router = Router();

/** Live SSE stream of all SOS events (created, updated, location, acknowledged, resolved) */
router.get('/stream', (req, res) => {
  createSseStream(req, res);
});

/** Quick list of all currently active (unresolved, within 2h) alerts */
router.get('/active', ah(async (_req, res) => {
  const items = await listAdminSos({
    where: `s.resolved_at IS NULL AND s.created_at > now() - make_interval(hours => ${ACTIVE_HOURS})`,
    limit: 50,
  });
  res.json({ items });
}));

/** Paginated list with filtering */
router.get('/', ah(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { defaultLimit: 25, maxLimit: 100 });
  const filter = req.query.filter || 'all';

  let where = 'TRUE';
  if (filter === 'unacknowledged') {
    where = 's.acknowledged_at IS NULL AND s.resolved_at IS NULL';
  } else if (filter === 'active') {
    where = `s.resolved_at IS NULL AND s.created_at > now() - make_interval(hours => ${ACTIVE_HOURS})`;
  } else if (filter === 'resolved') {
    where = 's.resolved_at IS NOT NULL';
  }

  const [items, { rows: [{ total }] }] = await Promise.all([
    listAdminSos({ where, limit, offset }),
    query(`SELECT count(*)::int AS total FROM sos_events s WHERE ${where}`),
  ]);

  res.json({ items, total, page, limit });
}));

/** Detail of a single alert, including full location trail */
router.get('/:id', validate(z.object({ id: uuid }), 'params'), ah(async (req, res) => {
  const [sos, trail] = await Promise.all([
    loadAdminSos(req.params.id),
    locationTrail(req.params.id),
  ]);
  if (!sos) throw notFound('Alert not found');
  res.json({ ...sos, trail });
}));

const noteSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

router.post('/:id/acknowledge', validate(z.object({ id: uuid }), 'params'), validate(noteSchema), ah(async (req, res) => {
  const sos = await acknowledge(req.admin, req.params.id, req.body.note);
  await audit(req, 'sos.acknowledge', req.params.id, { note: req.body.note });
  res.json(sos);
}));

router.post('/:id/resolve', validate(z.object({ id: uuid }), 'params'), validate(noteSchema), ah(async (req, res) => {
  const sos = await resolveByAdmin(req.admin, req.params.id, req.body.note);
  await audit(req, 'sos.resolve', req.params.id, { note: req.body.note });
  res.json(sos);
}));

export default router;
