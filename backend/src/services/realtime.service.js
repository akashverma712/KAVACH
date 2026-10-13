import { EventEmitter } from 'node:events';
import pg from 'pg';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';

const CHANNEL = 'kavach_realtime';
const instanceId = Math.random().toString(36).slice(2) + Date.now().toString(36);

const bus = new EventEmitter();
bus.setMaxListeners(0);

let listenerClient = null;
let reconnectTimer = null;
let isClosing = false;
let isConnected = false;

function scheduleReconnect() {
  isConnected = false;
  if (listenerClient) {
    try { listenerClient.end().catch(() => {}); } catch {}
    listenerClient = null;
  }
  if (isClosing) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(startListener, 3000);
}

async function startListener() {
  if (isClosing) return;
  try {
    const client = new pg.Client({
      connectionString: env.databaseUrl,
      ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
    });
    await client.connect();
    listenerClient = client;
    isConnected = true;

    await client.query(`LISTEN ${CHANNEL}`);

    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const { type, data, origin } = JSON.parse(msg.payload);
        if (origin !== instanceId) {
          bus.emit(type, data);
          bus.emit('*', { type, data });
        }
      } catch (err) {
        console.error('Failed to parse realtime notification payload:', err.message);
      }
    });

    client.on('error', (err) => {
      console.warn('Realtime LISTEN client error:', err.message);
      scheduleReconnect();
    });

    client.on('end', () => {
      scheduleReconnect();
    });
  } catch (err) {
    console.warn('Realtime LISTEN connection failed, retrying in 3s:', err.message);
    scheduleReconnect();
  }
}

// Start listener connection
startListener();

/**
 * Publish an event across all API instances using PostgreSQL NOTIFY.
 * Also emits locally immediately so the calling instance experiences zero delay.
 */
export async function publish(type, data) {
  // Deliver locally immediately
  bus.emit(type, data);
  bus.emit('*', { type, data });

  // Broadcast to other instances
  try {
    const payload = JSON.stringify({ type, data, origin: instanceId });
    // PostgreSQL NOTIFY limit is 8000 bytes
    if (payload.length < 7800) {
      await query('SELECT pg_notify($1, $2)', [CHANNEL, payload]);
    } else {
      console.warn(`Realtime payload for ${type} exceeds pg_notify limit (${payload.length} bytes), sent locally only.`);
    }
  } catch (err) {
    console.error('pg_notify broadcast error:', err.message);
  }
}

/** Subscribe to realtime events locally */
export function subscribe(type, handler) {
  bus.on(type, handler);
  return () => bus.off(type, handler);
}

/**
 * Express SSE helper for streaming events to clients.
 * Handles heartbeats, flush, and connection cleanup.
 */
export function createSseStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Initial comment to confirm connection
  res.write(': connected\n\n');

  const onEvent = ({ type, data }) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  bus.on('*', onEvent);

  // Heartbeat ping every 15 seconds to keep connection alive through proxies & detect dead connections
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
    if (typeof res.flush === 'function') res.flush();
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('*', onEvent);
    res.end();
  });
}

export async function closeRealtime() {
  isClosing = true;
  clearTimeout(reconnectTimer);
  if (listenerClient) {
    try {
      await listenerClient.end();
    } catch {}
    listenerClient = null;
  }
}
