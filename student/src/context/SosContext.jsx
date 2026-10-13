import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api';
import { enqueueSos, flushSosQueue, smsLink } from '../lib/offlineQueue';
import { playCancelTone, playCountdownTick, playSuccessChime } from '../lib/sounds';
import { uuidv4 } from '../lib/uuid';
import { useAlarm } from '../hooks/useAlarm';
import { useVoiceGuard } from '../hooks/useVoiceGuard';
import { SosOverlay } from '../components/SosOverlay';
import { useAuth } from './AuthContext';
import { useGeo } from './LocationContext';
import { useToast } from './ToastContext';

const SosCtx = createContext(null);

const COUNTDOWN_MS = 10_000;
const SHARE_EVERY_MS = 15_000;
const RETRY_DELAYS = [0, 1500, 4000, 8000];
const SEND_TIMEOUT_MS = 12_000;
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
  const [activeSos, setActiveSos] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const [contacts, setContacts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CONTACTS_KEY) || 'null');
    } catch {
      return null;
    }
  });

  const [voiceOn, setVoiceOnState] = useState(() => localStorage.getItem('kavach-voice') === 'on');
  const [soundBeeps, setSoundBeepsState] = useState(() => localStorage.getItem('kavach-beeps') !== 'off');
  const [keepAwake, setKeepAwakeState] = useState(() => localStorage.getItem('kavach-keep-awake') !== 'off');

  const sourceRef = useRef('button');
  const transcriptRef = useRef('');
  const clientIdRef = useRef(null);
  const deadlineRef = useRef(0);
  const sendingRef = useRef(false);
  const lastLocationSentRef = useRef({ lat: null, lng: null, at: 0 });

  const setVoiceOn = useCallback((on) => {
    localStorage.setItem('kavach-voice', on ? 'on' : 'off');
    setVoiceOnState(on);
  }, []);

  const setSoundBeeps = useCallback((on) => {
    localStorage.setItem('kavach-beeps', on ? 'on' : 'off');
    setSoundBeepsState(on);
  }, []);

  const setKeepAwake = useCallback((on) => {
    localStorage.setItem('kavach-keep-awake', on ? 'on' : 'off');
    setKeepAwakeState(on);
  }, []);

  // Fetch status and active alert
  const refreshStatus = useCallback(() => {
    if (!user) return Promise.resolve(null);
    return api('/sos/status')
      .then((d) => {
        setStatus(d);
        if (d.active) {
          setActiveSos(d.active);
        } else {
          setActiveSos((prev) => (prev && !prev.resolved_at ? null : prev));
        }
        return d;
      })
      .catch(() => null);
  }, [user]);

  const refreshContacts = useCallback(() => {
    if (!user) return Promise.resolve(null);
    return api('/me/contacts')
      .then((d) => {
        setContacts(d);
        localStorage.setItem(CONTACTS_KEY, JSON.stringify(d));
        return d;
      })
      .catch(() => null);
  }, [user]);

  // Flush offline queue when online
  const flush = useCallback(async () => {
    const n = await flushSosQueue((item) =>
      api('/sos', {
        method: 'POST',
        body: {
          lat: item.lat ?? null,
          lng: item.lng ?? null,
          accuracy: item.accuracy ?? null,
          trigger: 'offline_sync',
          client_id: item.client_id,
          client_time: item.client_time,
          transcript: item.transcript || null,
        },
      }),
    );
    if (n) {
      toast.success(`${n} offline SOS alert${n > 1 ? 's' : ''} sent.`);
      refreshStatus();
    }
  }, [refreshStatus, toast]);

  useEffect(() => {
    if (!user) return undefined;
    refreshStatus();
    refreshContacts();
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [user, refreshStatus, refreshContacts, flush]);

  // Poll for admin response while an SOS is active
  useEffect(() => {
    if (!activeSos || activeSos.resolved_at) return undefined;
    const interval = setInterval(() => {
      api(`/sos/${activeSos.id}`)
        .then((s) => {
          if (s) {
            setActiveSos(s);
            if (s.resolved_at) {
              toast.info('Your SOS alert has been closed.');
              setActiveSos(null);
              setPhase((p) => (p === 'sent' ? 'idle' : p));
            }
          }
        })
        .catch(() => {});
    }, 4500);
    return () => clearInterval(interval);
  }, [activeSos, toast]);

  // Live location sender loop
  useEffect(() => {
    if (!activeSos || activeSos.resolved_at || !user) return undefined;

    const maybeSendLocation = async () => {
      const loc = geo.coords;
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;

      const last = lastLocationSentRef.current;
      const now = Date.now();

      // Send if > 15s elapsed OR moved > 25 meters
      const elapsed = now - last.at;
      let movedDistance = 0;
      if (last.lat !== null && last.lng !== null) {
        const dLat = (loc.lat - last.lat) * 111_000;
        const dLng = (loc.lng - last.lng) * 111_000 * Math.cos((loc.lat * Math.PI) / 180);
        movedDistance = Math.hypot(dLat, dLng);
      }

      if (elapsed >= SHARE_EVERY_MS || movedDistance >= 25) {
        lastLocationSentRef.current = { lat: loc.lat, lng: loc.lng, at: now };
        api(`/sos/${activeSos.id}/location`, {
          method: 'POST',
          body: { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null },
        }).catch(() => {});
      }
    };

    const locTimer = setInterval(maybeSendLocation, 5000);
    return () => clearInterval(locTimer);
  }, [activeSos, geo.coords, user]);

  // VoiceGuard engine hook
  const handleVoiceMatch = useCallback((match) => {
    if (phase === 'idle') {
      trigger('voice', match.transcript);
    } else if (phase === 'countdown') {
      if (match.mode === 'cancel') {
        cancel();
      }
    }
  }, [phase]);

  const voiceGuard = useVoiceGuard({
    enabled: Boolean(user) && voiceOn,
    lang: 'en-IN',
    fuzzy: true,
    keepAwake,
    onMatch: handleVoiceMatch,
  });

  // Switch VoiceGuard mode according to current SOS phase
  useEffect(() => {
    if (phase === 'countdown') {
      voiceGuard.setMode('cancel');
    } else {
      voiceGuard.setMode('trigger');
    }
  }, [phase, voiceGuard]);

  // Trigger countdown
  const trigger = useCallback((source = 'button', heardText = '') => {
    if (phase !== 'idle') return;
    sourceRef.current = source;
    transcriptRef.current = heardText;
    clientIdRef.current = uuidv4();
    deadlineRef.current = Date.now() + COUNTDOWN_MS;
    setMsLeft(COUNTDOWN_MS);
    setError(null);
    setResult(null);
    setRetryCount(0);
    navigator.vibrate?.([200, 100, 200]);
    setPhase('countdown');
  }, [phase]);

  // Countdown timer loop with sound beeps
  useEffect(() => {
    if (phase !== 'countdown') return undefined;

    const lastSecRef = { current: Math.ceil(COUNTDOWN_MS / 1000) };

    const t = setInterval(() => {
      const left = deadlineRef.current - Date.now();
      const clamped = Math.max(0, left);
      setMsLeft(clamped);

      const sec = Math.ceil(clamped / 1000);
      if (sec !== lastSecRef.current && sec > 0) {
        lastSecRef.current = sec;
        if (soundBeeps) playCountdownTick(sec);
        navigator.vibrate?.(60);
      }

      if (left <= 0) {
        clearInterval(t);
        send();
      }
    }, 150);

    return () => clearInterval(t);
  }, [phase, soundBeeps]);

  // Cancel action
  const cancel = useCallback(() => {
    navigator.vibrate?.(0);
    if (soundBeeps) playCancelTone();
    setPhase('idle');
  }, [soundBeeps]);

  // Close overlay (minimizes to banner)
  const close = useCallback(() => {
    alarm.stop();
    setPhase('idle');
  }, [alarm]);

  // Reopen overlay from banner
  const reopenOverlay = useCallback(() => {
    setPhase('sent');
  }, []);

  const numbers = useMemo(() => {
    const list = [...(contacts?.contacts || []), ...(contacts?.system || [])];
    return list.map((c) => c.phone);
  }, [contacts]);

  const smsText = useCallback(
    (loc) =>
      [
        `SOS! ${user?.name || 'A student'}${user?.regd_no ? ` (${user.regd_no})` : ''} needs urgent help.`,
        loc ? `Location: https://www.google.com/maps?q=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}` : 'Location unavailable.',
        '- Kavach, BIT Sindri',
      ].join('\n'),
    [user],
  );

  // Send SOS with 4 retries & idempotency
  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setPhase('sending');
    navigator.vibrate?.(0);

    const clientId = clientIdRef.current || uuidv4();
    clientIdRef.current = clientId;

    const recent = geo.coords && Date.now() - geo.coords.at < 20_000;
    const loc = recent ? geo.coords : await geo.getFresh(4000);

    const payload = {
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      accuracy: loc?.accuracy ?? null,
      trigger: sourceRef.current,
      client_id: clientId,
      client_time: new Date().toISOString(),
      transcript: transcriptRef.current || null,
    };

    const goOffline = () => {
      enqueueSos(payload);
      setResult({ loc, trigger: payload.trigger });
      setPhase('offline');
      sendingRef.current = false;
    };

    if (!navigator.onLine) {
      goOffline();
      return;
    }

    let success = false;
    let lastErr = null;

    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt += 1) {
      if (attempt > 0) {
        setRetryCount(attempt);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

        // eslint-disable-next-line no-await-in-loop
        const r = await api('/sos', {
          method: 'POST',
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        setResult({ ...r, loc });
        setActiveSos(r);
        setStatus((s) => ({
          ...(s || {}),
          remaining: r.remaining,
          used: r.used,
          max: r.max,
          resets_at: r.resets_at,
        }));
        setPhase('sent');
        if (soundBeeps) playSuccessChime();
        navigator.vibrate?.([80, 60, 80]);
        refreshStatus();
        success = true;
        break;
      } catch (err) {
        lastErr = err;
        if (err.status === 429) {
          // Rate limit reached - do not retry
          break;
        }
      }
    }

    sendingRef.current = false;

    if (!success) {
      if (!navigator.onLine || lastErr?.name === 'AbortError' || lastErr?.status === 0) {
        goOffline();
      } else {
        setError(lastErr);
        setResult({ loc });
        setPhase('error');
      }
    }
  }, [geo, soundBeeps, refreshStatus]);

  // Mark safe action
  const markSafe = useCallback(async (note = '') => {
    if (!activeSos) return;
    try {
      await api(`/sos/${activeSos.id}/safe`, {
        method: 'POST',
        body: { note: note || null },
      });
      toast.success('Marked as safe. Contacts have been updated.');
      setActiveSos(null);
      setPhase('idle');
      refreshStatus();
    } catch (e) {
      toast.error(e.message || 'Failed to update status');
    }
  }, [activeSos, toast, refreshStatus]);

  const value = useMemo(
    () => ({
      phase,
      trigger,
      cancel,
      status,
      activeSos,
      refreshStatus,
      contacts,
      setContacts: (d) => {
        setContacts(d);
        localStorage.setItem(CONTACTS_KEY, JSON.stringify(d));
      },
      refreshContacts,
      voiceOn,
      setVoiceOn,
      voiceGuard,
      soundBeeps,
      setSoundBeeps,
      keepAwake,
      setKeepAwake,
      markSafe,
      reopenOverlay,
    }),
    [
      phase,
      trigger,
      cancel,
      status,
      activeSos,
      refreshStatus,
      contacts,
      refreshContacts,
      voiceOn,
      setVoiceOn,
      voiceGuard,
      soundBeeps,
      setSoundBeeps,
      keepAwake,
      setKeepAwake,
      markSafe,
      reopenOverlay,
    ],
  );

  return (
    <SosCtx.Provider value={value}>
      {children}
      {phase !== 'idle' && (
        <SosOverlay
          phase={phase}
          msLeft={msLeft}
          source={sourceRef.current}
          transcript={transcriptRef.current}
          result={result}
          error={error}
          status={status}
          activeSos={activeSos}
          numbers={numbers}
          smsHref={numbers.length ? smsLink(numbers, smsText(result?.loc || geo.coords)) : null}
          alarm={alarm}
          retryCount={retryCount}
          voiceMode={voiceGuard?.mode}
          onCancel={cancel}
          onSendNow={() => {
            deadlineRef.current = Date.now();
          }}
          onClose={close}
          onMarkSafe={markSafe}
        />
      )}
    </SosCtx.Provider>
  );
}

export const useSos = () => useContext(SosCtx);
