/**
 * VoiceGuard — a self-healing wrapper around the Web Speech API.
 *
 * Why this exists: Chrome's SpeechRecognition stops on its own all the time — after a few seconds
 * of silence ("no-speech"), on network hiccups, when the tab is hidden, when the screen locks, and
 * occasionally it just hangs without firing any event. A naive "restart on end" loop misses these
 * cases and the app silently stops listening. VoiceGuard:
 *
 *   • asks for microphone permission explicitly (clear error if blocked or missing)
 *   • restarts after every end/error with backoff, and a watchdog restarts a hung recogniser
 *   • pauses while the tab is hidden and resumes the moment it is visible again
 *   • keeps the screen awake (Screen Wake Lock) so the phone doesn't sleep and kill the mic
 *   • checks interim AND final results, and every alternative transcript, for keywords
 *   • has two modes: 'trigger' (listen for "help") and 'cancel' (during the countdown)
 *   • reports a detailed state object so the UI can show exactly what is happening
 */
import { findKeyword } from './keywords';

const Recognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const voiceSupported = () => Boolean(Recognition());

const HUNG_AFTER_MS = 20_000;   // no events for this long while "running" → restart
const MATCH_DEBOUNCE_MS = 2500;  // ignore repeat matches right after one

export class VoiceGuard {
  constructor({ onMatch, onState, lang = 'en-IN', fuzzy = true, keepAwake = true } = {}) {
    this.onMatch = onMatch;
    this.onState = onState;
    this.lang = lang;
    this.fuzzy = fuzzy;
    this.keepAwake = keepAwake;
    this.mode = 'trigger';
    this.wanted = false;
    this.rec = null;
    this.running = false;
    this.pending = false;
    this.restartTimer = null;
    this.watchdog = null;
    this.backoff = 300;
    this.lastEventAt = 0;
    this.lastMatchAt = 0;
    this.wakeLock = null;
    this.startToken = 0;
    this.state = { status: 'off', heard: '', lastMatch: null, error: null, restarts: 0, mode: 'trigger', lang, wakeLock: false };
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  emit(patch) {
    this.state = { ...this.state, ...patch };
    this.onState?.(this.state);
  }

  async start() {
    if (this.wanted) return true;
    if (!Recognition()) {
      this.emit({ status: 'unsupported', error: 'Voice SOS needs Chrome, Edge or Safari. This browser has no speech recognition.' });
      return false;
    }
    if (!window.isSecureContext) {
      this.emit({ status: 'error', error: 'Voice SOS needs a secure connection (HTTPS or localhost).' });
      return false;
    }
    this.wanted = true;
    const token = ++this.startToken;
    this.emit({ status: 'starting', error: null, restarts: 0 });

    // Explicit permission request: gives a clear error and wakes up the audio hardware.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        if (token !== this.startToken) return false;
        this.wanted = false;
        const missing = err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError';
        this.emit({ status: 'blocked', error: missing ? 'No microphone was found on this device.' : 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then turn voice SOS on again.' });
        return false;
      }
    }
    // Stopped (or restarted) while the permission prompt was open
    if (!this.wanted || token !== this.startToken) return false;

    document.addEventListener('visibilitychange', this.handleVisibility);
    this.watchdog = setInterval(() => this.tick(), 4000);
    this.requestWakeLock();
    this.spawn();
    return true;
  }

  stop() {
    this.wanted = false;
    this.startToken += 1;
    clearTimeout(this.restartTimer);
    clearInterval(this.watchdog);
    this.pending = false;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.kill();
    this.releaseWakeLock();
    this.emit({ status: 'off', heard: '' });
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.emit({ mode });
    // Restart so words already buffered in the old mode can't match in the new one.
    if (this.wanted) this.restartSoon(150);
  }

  /* ───────── internals ───────── */

  spawn() {
    this.pending = false;
    if (!this.wanted || this.running) return;
    if (document.visibilityState === 'hidden') {
      this.emit({ status: 'paused' });
      return;
    }
    const Rec = Recognition();
    const rec = new Rec();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    rec.onstart = () => { this.lastEventAt = Date.now(); this.emit({ status: 'listening', error: null }); };
    rec.onaudiostart = () => { this.lastEventAt = Date.now(); };
    rec.onsoundstart = () => { this.lastEventAt = Date.now(); };
    rec.onspeechstart = () => { this.lastEventAt = Date.now(); };
    rec.onresult = (e) => this.handleResult(e);
    rec.onerror = (e) => this.handleError(e);
    rec.onend = () => {
      if (this.rec !== rec) return; // a newer instance already took over
      this.rec = null;
      this.running = false;
      if (this.wanted) this.restartSoon();
    };

    this.rec = rec;
    this.running = true;
    this.lastEventAt = Date.now();
    try {
      rec.start();
    } catch {
      this.rec = null;
      this.running = false;
      this.restartSoon(1000);
    }
  }

  handleResult(e) {
    this.lastEventAt = Date.now();
    this.backoff = 300;
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const result = e.results[i];
      for (let a = 0; a < result.length; a += 1) {
        const text = result[a]?.transcript || '';
        if (a === 0 && text.trim()) this.emit({ heard: text.trim().slice(-90) });
        const word = findKeyword(text, this.mode, { fuzzy: this.fuzzy });
        if (!word) continue;
        if (Date.now() - this.lastMatchAt < MATCH_DEBOUNCE_MS) return;
        this.lastMatchAt = Date.now();
        const match = { word, transcript: text.trim(), mode: this.mode, at: Date.now() };
        this.emit({ lastMatch: match });
        try { this.onMatch?.(match); } catch (err) { console.error(err); }
        this.restartSoon(250); // flush the recogniser's buffer
        return;
      }
    }
  }

  handleError(e) {
    const err = e?.error;
    if (err === 'no-speech' || err === 'aborted') return; // normal; onend restarts
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      this.wanted = false;
      this.emit({ status: 'blocked', error: 'Microphone or speech service permission was denied. Allow it in your browser settings and turn voice SOS on again.' });
      return;
    }
    if (err === 'network') {
      this.backoff = Math.min(Math.max(this.backoff * 2, 2000), 15000);
      this.emit({ status: 'error', error: 'Speech service unreachable. Chrome needs internet for voice recognition. Retrying…' });
      return;
    }
    if (err === 'audio-capture') {
      this.backoff = 5000;
      this.emit({ status: 'error', error: 'The microphone is not available. Another app may be using it. Retrying…' });
      return;
    }
    if (err === 'language-not-supported' && this.lang !== 'en-US') {
      this.lang = 'en-US';
      this.emit({ lang: 'en-US' });
      return;
    }
    this.emit({ error: `Speech recognition error: ${err}` });
  }

  restartSoon(delay = this.backoff) {
    if (!this.wanted) return;
    this.kill();
    clearTimeout(this.restartTimer);
    this.pending = true;
    this.emit({ restarts: this.state.restarts + 1, status: this.state.status === 'error' ? 'error' : 'restarting' });
    this.restartTimer = setTimeout(() => this.spawn(), delay);
  }

  kill() {
    const r = this.rec;
    this.rec = null;
    this.running = false;
    if (!r) return;
    r.onend = null; r.onresult = null; r.onerror = null; r.onstart = null;
    try { r.abort(); } catch { /* already stopped */ }
  }

  tick() {
    if (!this.wanted || document.visibilityState === 'hidden') return;
    if (!this.running && !this.pending) this.spawn();                                 // fell over without onend
    else if (this.running && Date.now() - this.lastEventAt > HUNG_AFTER_MS) this.restartSoon(100); // hung recogniser
    if (this.keepAwake && !this.wakeLock) this.requestWakeLock();
  }

  handleVisibility() {
    if (!this.wanted) return;
    if (document.visibilityState === 'visible') {
      this.requestWakeLock();
      if (!this.running) this.restartSoon(100);
    } else {
      this.emit({ status: 'paused' });
    }
  }

  async requestWakeLock() {
    if (!this.keepAwake || this.wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.emit({ wakeLock: true });
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; this.emit({ wakeLock: false }); });
    } catch { /* battery saver or unsupported */ }
  }

  releaseWakeLock() {
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }
}
