import { query } from '../db/pool.js';

export async function notify(userId, { title, body = null, link = null }) {
  try {
    await query('INSERT INTO notifications (user_id, title, body, link) VALUES ($1, $2, $3, $4)', [userId, title, body, link]);
  } catch (err) {
    console.error('Failed to create notification', err.message);
  }
}

export async function audit(req, action, target = null, meta = null) {
  const actorType = req.admin ? 'admin' : req.user ? 'user' : 'system';
  const actorId = req.admin?.id || req.user?.id || null;
  try {
    await query(
      'INSERT INTO audit_logs (actor_type, actor_id, action, target, meta, ip) VALUES ($1, $2, $3, $4, $5, $6)',
      [actorType, actorId, action, target, meta ? JSON.stringify(meta) : null, req.ip],
    );
  } catch (err) {
    console.error('Failed to write audit log', err.message);
  }
}
