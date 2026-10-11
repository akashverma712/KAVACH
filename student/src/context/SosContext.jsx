import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, Check, MessageSquare, Phone, Volume2, VolumeX, WifiOff, X } from 'lucide-react';
import { api } from '../lib/api';
import { enqueueSos, flushSosQueue, smsLink } from '../lib/offlineQueue';
import { useAlarm } from '../hooks/useAlarm';
import { useVoiceTrigger } from '../hooks/useVoiceTrigger';
import { Button } from '../components/ui';
import { useAuth } from './AuthContext';
import { useGeo } from './LocationContext';
import { useToast } from './ToastContext';

const SosCtx = createContext(null);
const COUNTDOWN_MS = 10_000;
const CONTACTS_KEY = 'kavach-contacts';

export function SosProvider({ children }) {
  const { user } = useAuth();
  const geo = useGeo();
  const toast = useToast();
  const alarm = useAlarm();

  const [phase, setPhase] = useState('idle'); // idle | countdown | sending | sent | offline | error
  const [msLeft, setMsLeft] = useState(COUNTDOWN_MS);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || 'null'); } catch { return null; }
  });
  const [voiceOn, setVoiceOnState] = useState(() => localStorage.getItem('kavach-voice') === 'on');

  const sourceRef = useRef('button');
  const deadline = useRef(0);
  const sendingRef = useRef(false);

  const refreshStatus = useCallback(() => api('/sos/status').then(setStatus).catch(() => {}), []);
  const refreshContacts = useCallback(() => api('/me/contacts').then((d) => {
    setContacts(d);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(d));
    return d;
  }).catch(() => null), []);

  const flush = useCallback(async () => {
    const n = await flushSosQueue((item) => api('/sos', {
      method: 'POST',
      body: { lat: item.lat ?? null, lng: item.lng ?? null, accuracy: item.accuracy ?? null, trigger: 'offline_sync', client_time: item.client_time },
    }));
    if (n) { toast.success(`${n} SOS alert${n > 1 ? 's' : ''} queued while offline ${n > 1 ? 'were' : 'was'} sent.`); refreshStatus(); }
  }, [refreshStatus, toast]);

  useEffect(() => {
    if (!user) return undefined;
    refreshStatus();
    refreshContacts();
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [user, refreshStatus, refreshContacts, flush]);

  const numbers = useMemo(() => [...(contacts?.contacts || []), ...(contacts?.system || [])].map((c) => c.phone), [contacts]);

  const smsText = useCallback((loc) => [
    `SOS! ${user?.name || 'A student'}${user?.regd_no ? ` (${user.regd_no})` : ''} needs urgent help.`,
    loc ? `Location: https://www.google.com/maps?q=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}` : 'Location unavailable.',
    '- Kavach, BIT Sindri',
  ].join('\n'), [user]);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setPhase('sending');
    navigator.vibrate?.(0);
    // Use a recent fix immediately; only wait (briefly) for GPS if the last one is stale.
    const recent = geo.coords && Date.now() - geo.coords.at < 20_000;
    const loc = recent ? geo.coords : await geo.getFresh(4000);
    const payload = { lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null, trigger: sourceRef.current };
    const goOffline = () => {
      enqueueSos({ ...payload, client_time: new Date().toISOString() });
      setResult({ loc });
      setPhase('offline');
    };
    try {
      if (!navigator.onLine) goOffline();
      else {
        const r = await api('/sos', { method: 'POST', body: payload });
        setResult({ ...r, loc });
        setStatus((s) => ({ ...(s || {}), remaining: r.remaining, used: r.used, max: r.max, resets_at: r.resets_at }));
        setPhase('sent');
        navigator.vibrate?.([80, 60, 80]);
        refreshStatus();
      }
    } catch (e) {
      if (e.status === 0) goOffline();
      else { setError(e); setResult({ loc }); setPhase('error'); }
    } finally {
      sendingRef.current = false;
    }
  }, [geo, refreshStatus]);

  const phaseRef = useRef('idle');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const trigger = useCallback((source = 'button') => {
    if (phaseRef.current !== 'idle') return;
    phaseRef.current = 'countdown';
    sourceRef.current = source;
    deadline.current = Date.now() + COUNTDOWN_MS;
    setMsLeft(COUNTDOWN_MS);
    setError(null);
    setResult(null);
    navigator.vibrate?.([200, 100, 200]);
    setPhase('countdown');
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    const t = setInterval(() => {
      const left = deadline.current - Date.now();
      setMsLeft(Math.max(0, left));
      if (left <= 0) { clearInterval(t); send(); }
      else if (Math.ceil(left / 1000) !== Math.ceil((left + 200) / 1000)) navigator.vibrate?.(60);
    }, 200);
    return () => clearInterval(t);
  }, [phase, send]);

  const cancel = useCallback(() => { navigator.vibrate?.(0); setPhase('idle'); }, []);
  const close = useCallback(() => { alarm.stop(); setPhase('idle'); }, [alarm]);

  const setVoiceOn = useCallback((on) => {
    localStorage.setItem('kavach-voice', on ? 'on' : 'off');
    setVoiceOnState(on);
  }, []);
  const voice = useVoiceTrigger(Boolean(user) && voiceOn && phase === 'idle', () => trigger('voice'));

  const value = useMemo(() => ({
    phase, trigger, cancel, status, refreshStatus, contacts, setContacts: (d) => { setContacts(d); localStorage.setItem(CONTACTS_KEY, JSON.stringify(d)); },
    refreshContacts, voiceOn, setVoiceOn, voice,
  }), [phase, trigger, cancel, status, refreshStatus, contacts, refreshContacts, voiceOn, setVoiceOn, voice]);

  return (
    <SosCtx.Provider value={value}>
      {children}
      {phase !== 'idle' && (
        <SosOverlay
          phase={phase}
          msLeft={msLeft}
          source={sourceRef.current}
          result={result}
          error={error}
          status={status}
          numbers={numbers}
          smsHref={numbers.length ? smsLink(numbers, smsText(result?.loc || geo.coords)) : null}
          alarm={alarm}
          onCancel={cancel}
          onSendNow={() => { deadline.current = Date.now(); }}
          onClose={close}
        />
      )}
    </SosCtx.Provider>
  );
}

export const useSos = () => useContext(SosCtx);

/* ───────────────────────── Overlay ───────────────────────── */

function SosOverlay({ phase, msLeft, source, result, error, status, numbers, smsHref, alarm, onCancel, onSendNow, onClose }) {
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, [phase]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && phase === 'countdown') onCancel(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [phase, onCancel]);

  const seconds = Math.ceil(msLeft / 1000);
  const R = 92;
  const C = 2 * Math.PI * R;
  const frac = msLeft / COUNTDOWN_MS;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="sos-title" aria-describedby="sos-desc"
      className={`fixed inset-0 z-[1100] flex flex-col items-center justify-center overflow-y-auto px-6 py-10 text-white ${phase === 'sent' ? 'bg-[#0f3d2f]' : 'bg-[#4a0b14]'}`}>
      {(phase === 'countdown' || phase === 'sending') && (
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-white/80">
            <BellRing className="h-4 w-4" aria-hidden /> {source === 'voice' ? 'Voice trigger heard "help"' : 'SOS button pressed'}
          </p>
          <h2 id="sos-title" className="font-display text-3xl font-extrabold">
            {phase === 'sending' ? 'Sending your SOS…' : 'Sending SOS in'}
          </h2>
          <div className="relative my-8 h-56 w-56">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="10" />
              <circle cx="100" cy="100" r={R} fill="none" stroke="#ff5464" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === 'sending'
                ? <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" aria-label="Sending" />
                : <span className="font-display text-8xl font-extrabold tabular-nums" aria-live="assertive">{seconds}</span>}
            </div>
          </div>
          <p id="sos-desc" className="mb-8 text-white/80">
            Your live location will go by SMS to {numbers.length || 'your'} emergency contact{numbers.length === 1 ? '' : 's'}, including the campus admin.
          </p>
          {phase === 'countdown' && (
            <div className="flex w-full flex-col gap-3">
              <button ref={cancelRef} type="button" onClick={onCancel}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-panel bg-white text-xl font-extrabold text-[#4a0b14] hover:bg-white/90">
                <X className="h-6 w-6" aria-hidden /> Cancel — I'm safe
              </button>
              <button type="button" onClick={onSendNow} className="h-12 w-full rounded-panel border border-white/40 font-bold hover:bg-white/10">
                Send now
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'sent' && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#0f3d2f]"><Check className="h-11 w-11" strokeWidth={3} /></span>
          <h2 id="sos-title" className="font-display text-3xl font-extrabold">SOS sent</h2>
          <p id="sos-desc" className="mt-2 text-white/85">
            {result?.delivery_mode === 'console'
              ? 'Your alert reached the Kavach server. SMS delivery is not configured yet, so the messages were printed in the server terminal.'
              : 'Your contacts have your location. Stay where you are if it is safe, and keep your phone with you.'}
          </p>
          {!result?.maps_url && <p className="mt-3 rounded-control bg-white/10 px-3 py-2 text-sm">Your location was unavailable, so the alert was sent without a map link.</p>}
          <ul className="mt-6 w-full divide-y divide-white/10 rounded-panel bg-white/10 text-left">
            {(result?.recipients || []).map((r) => (
              <li key={r.phone + r.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <span><span className="block font-bold">{r.name}</span><span className="text-sm text-white/70">{r.phone}</span></span>
                <span className="text-sm font-bold">{r.error ? 'Failed' : r.delivered ? 'Delivered' : 'Logged'}</span>
              </li>
            ))}
          </ul>
          {status && <p className="mt-3 text-sm text-white/70">{status.remaining} of {status.max} alerts left this hour.</p>}
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <button type="button" onClick={alarm.toggle} className="flex h-12 items-center justify-center gap-2 rounded-panel border border-white/40 font-bold hover:bg-white/10">
              {alarm.on ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />} {alarm.on ? 'Stop alarm' : 'Sound alarm'}
            </button>
            <a href="tel:112" className="flex h-12 items-center justify-center gap-2 rounded-panel border border-white/40 font-bold hover:bg-white/10"><Phone className="h-5 w-5" /> Call 112</a>
          </div>
          <button ref={cancelRef} type="button" onClick={onClose} className="mt-3 h-12 w-full rounded-panel bg-white font-extrabold text-[#0f3d2f] hover:bg-white/90">Done</button>
        </div>
      )}

      {(phase === 'offline' || phase === 'error') && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
            {phase === 'offline' ? <WifiOff className="h-10 w-10" /> : <AlertTriangle className="h-10 w-10" />}
          </span>
          <h2 id="sos-title" className="font-display text-3xl font-extrabold">{phase === 'offline' ? 'You are offline' : 'SOS not sent'}</h2>
          <p id="sos-desc" className="mt-2 text-white/85">
            {phase === 'offline'
              ? 'Send the alert from your phone\'s SMS app now. We have also queued it and will send it automatically when you reconnect.'
              : error?.message}
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            {smsHref && (
              <a href={smsHref} className="flex h-14 items-center justify-center gap-2 rounded-panel bg-white text-lg font-extrabold text-[#4a0b14] hover:bg-white/90">
                <MessageSquare className="h-5 w-5" /> Send by SMS app
              </a>
            )}
            <a href="tel:112" className="flex h-12 items-center justify-center gap-2 rounded-panel border border-white/40 font-bold hover:bg-white/10"><Phone className="h-5 w-5" /> Call 112</a>
            <Button ref={cancelRef} variant="ghost" onClick={onClose} className="h-12 text-white hover:bg-white/10">Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
