import { tokenStore } from './api';

const BASE = import.meta.env.VITE_API_URL || '';
const STREAM_URL = `${BASE}/api/admin/sos/stream`;
const WATCHDOG_TIMEOUT_MS = 45_000;

/**
 * Fetch-based Server-Sent Events client for SOS stream.
 * Features:
 *   - Custom Authorization header (standard EventSource does not support headers)
 *   - Automatic reconnection with backoff
 *   - 45-second dead-connection watchdog (resets on heartbeats)
 *   - Parsing of multi-line data & custom event types
 */
export class SosStream {
  constructor({ onEvent, onStatus } = {}) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.abortController = null;
    this.watchdogTimer = null;
    this.reconnectTimer = null;
    this.running = false;
    this.backoff = 1000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.backoff = 1000;
    this.connect();
  }

  stop() {
    this.running = false;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.watchdogTimer);
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
    this.onStatus?.('disconnected');
  }

  resetWatchdog() {
    clearTimeout(this.watchdogTimer);
    if (!this.running) return;
    this.watchdogTimer = setTimeout(() => {
      console.warn('SSE stream watchdog timeout (no heartbeats for 45s) — reconnecting…');
      this.reconnect();
    }, WATCHDOG_TIMEOUT_MS);
  }

  scheduleReconnect() {
    if (!this.running) return;
    clearTimeout(this.reconnectTimer);
    this.onStatus?.('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 1.8, 15_000);
  }

  reconnect() {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
    this.scheduleReconnect();
  }

  async connect() {
    if (!this.running) return;
    clearTimeout(this.watchdogTimer);

    const token = tokenStore.get();
    if (!token) {
      this.onStatus?.('disconnected');
      return;
    }

    this.abortController = new AbortController();

    try {
      this.onStatus?.('connecting');
      const res = await fetch(STREAM_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`SSE stream connection failed with HTTP ${res.status}`);
      }

      this.backoff = 1000;
      this.onStatus?.('connected');
      this.resetWatchdog();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let currentEvent = 'message';
      let currentData = '';

      while (this.running) {
        // eslint-disable-next-line no-await-in-loop
        const { value, done } = await reader.read();
        if (done) break;

        this.resetWatchdog();
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            // Empty line marks end of event
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData);
                this.onEvent?.(currentEvent, parsed);
              } catch (e) {
                console.warn('Failed to parse SSE data JSON:', currentData, e);
              }
              currentData = '';
              currentEvent = 'message';
            }
            continue;
          }

          if (trimmed.startsWith(':')) {
            // SSE comment / heartbeat
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataPart = trimmed.slice(5).trim();
            currentData = currentData ? `${currentData}\n${dataPart}` : dataPart;
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && this.running) {
        console.warn('SSE stream error:', err.message);
      }
    } finally {
      if (this.running) {
        this.scheduleReconnect();
      }
    }
  }
}
