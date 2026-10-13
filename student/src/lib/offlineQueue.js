import { uuidv4 } from './uuid';

// SOS alerts triggered without internet are queued here and sent automatically once back online.
const KEY = 'kavach-sos-queue';

export const readQueue = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

const write = (q) => localStorage.setItem(KEY, JSON.stringify(q));

export function enqueueSos(item) {
  const q = readQueue();
  const clientId = item.client_id || uuidv4();
  const queuedItem = {
    ...item,
    client_id: clientId,
    client_time: item.client_time || new Date().toISOString(),
    queued_at: new Date().toISOString(),
  };
  q.push(queuedItem);
  write(q.slice(-5));
  return queuedItem;
}

export async function flushSosQueue(send) {
  const q = readQueue();
  if (!q.length || !navigator.onLine) return 0;
  let sent = 0;
  const remaining = [];
  for (const item of q) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await send(item);
      sent += 1;
    } catch (err) {
      if (err.status === 0 || !navigator.onLine) {
        remaining.push(item); // still offline — keep it
      }
    }
  }
  write(remaining);
  return sent;
}

/** Build an sms: link so the phone's own SMS app can send the alert without internet. */
export function smsLink(numbers, text) {
  const to = numbers.join(',');
  const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios ? `sms:/open?addresses=${to}&body=${encodeURIComponent(text)}` : `sms:${to}?body=${encodeURIComponent(text)}`;
}
