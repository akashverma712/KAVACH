import { query } from '../db/pool.js';

export async function getSettings(keys) {
  const { rows } = await query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

export async function getAdminEmergencyContact() {
  const s = await getSettings(['admin_emergency_phone', 'admin_emergency_name']);
  return { name: s.admin_emergency_name || 'Campus Admin', phone: s.admin_emergency_phone || null };
}
