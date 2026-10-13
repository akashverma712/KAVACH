import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api';
import { isSirenActive, startSiren, stopSiren, unlockAudio } from '../lib/siren';
import { SosStream } from '../lib/sosStream';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SosAlertCtx = createContext(null);

const POLL_INTERVAL_MS = 20_000;
const SIREN_KEY = 'kavach-admin-siren-enabled';

export function SosAlertProvider({ children }) {
  const { admin } = useAuth();
  const toast = useToast();

  const [streamStatus, setStreamStatus] = useState('disconnected');
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [modalAlert, setModalAlert] = useState(null);

  const [sirenEnabled, setSirenEnabledState] = useState(() => {
    return localStorage.getItem(SIREN_KEY) === 'on';
  });

  const [notificationPerm, setNotificationPerm] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  });

  const streamRef = useRef(null);
  const titleIntervalRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'Kavach Admin');

  const setSirenEnabled = useCallback((on) => {
    localStorage.setItem(SIREN_KEY, on ? 'on' : 'off');
    setSirenEnabledState(on);
    if (on) {
      unlockAudio().catch(() => {});
    } else {
      stopSiren();
    }
  }, []);

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';
    try {
      const perm = await Notification.requestPermission();
      setNotificationPerm(perm);
      return perm;
    } catch {
      return 'denied';
    }
  }, []);

  // Fetch active alerts from server
  const fetchActive = useCallback(async () => {
    if (!admin) return [];
    try {
      const data = await api('/admin/sos/active');
      const items = data?.items || [];
      setActiveAlerts(items);
      return items;
    } catch {
      return [];
    }
  }, [admin]);

  // Flash tab title while unacknowledged alerts exist
  const unacknowledgedCount = activeAlerts.filter((a) => !a.acknowledged_at && !a.resolved_at).length;

  useEffect(() => {
    if (unacknowledgedCount > 0) {
      if (!titleIntervalRef.current) {
        let toggle = false;
        titleIntervalRef.current = setInterval(() => {
          toggle = !toggle;
          document.title = toggle
            ? `🚨 SOS ALERT (${unacknowledgedCount})!`
            : originalTitleRef.current;
        }, 1000);
      }
    } else {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
        document.title = originalTitleRef.current;
      }
    }
    return () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
    };
  }, [unacknowledgedCount]);

  // Siren logic: if unacknowledged alert is open and siren is enabled, sound siren
  useEffect(() => {
    if (unacknowledgedCount > 0 && sirenEnabled) {
      startSiren();
    } else {
      stopSiren();
    }
  }, [unacknowledgedCount, sirenEnabled]);

  // Show desktop notification
  const notifyDesktop = useCallback((sos) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(`🚨 EMERGENCY SOS: ${sos.name}`, {
        body: `${sos.regd_no ? `(${sos.regd_no}) ` : ''}${sos.branch || ''} — Needs immediate assistance!\nLocation: ${
          sos.lat ? `${sos.lat.toFixed(5)}, ${sos.lng.toFixed(5)}` : 'GPS unavailable'
        }`,
        icon: '/favicon.svg',
        tag: `sos-${sos.id}`,
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        setModalAlert(sos);
        n.close();
      };
    } catch {}
  }, []);

  // Handle incoming stream events
  const handleStreamEvent = useCallback(
    (type, data) => {
      if (type === 'sos.created') {
        const { sos } = data;
        if (!sos) return;

        setActiveAlerts((prev) => {
          const exists = prev.some((x) => x.id === sos.id);
          return exists ? prev.map((x) => (x.id === sos.id ? { ...x, ...sos } : x)) : [sos, ...prev];
        });

        // Trigger alarm modal, siren & desktop notification
        setModalAlert(sos);
        notifyDesktop(sos);

        window.dispatchEvent(new Event('kavach-refresh-counts'));
        toast.error(`EMERGENCY SOS received from ${sos.name}!`, { duration: 10_000 });
      } else if (type === 'sos.updated') {
        const { sos } = data;
        if (!sos) return;

        setActiveAlerts((prev) => prev.map((x) => (x.id === sos.id ? { ...x, ...sos } : x)));
        setModalAlert((current) => (current && current.id === sos.id ? { ...current, ...sos } : current));
      } else if (type === 'sos.location') {
        const { id, lat, lng, accuracy, at } = data;
        setActiveAlerts((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  last_lat: lat,
                  last_lng: lng,
                  last_accuracy: accuracy,
                  last_location_at: at,
                  lat: x.lat ?? lat,
                  lng: x.lng ?? lng,
                }
              : x,
          ),
        );
        setModalAlert((current) =>
          current && current.id === id
            ? {
                ...current,
                last_lat: lat,
                last_lng: lng,
                last_accuracy: accuracy,
                last_location_at: at,
                lat: current.lat ?? lat,
                lng: current.lng ?? lng,
              }
            : current,
        );
      } else if (type === 'sos.acknowledged') {
        const { sos } = data;
        if (!sos) return;

        setActiveAlerts((prev) => prev.map((x) => (x.id === sos.id ? { ...x, ...sos } : x)));
        setModalAlert((current) => (current && current.id === sos.id ? { ...current, ...sos } : current));
        window.dispatchEvent(new Event('kavach-refresh-counts'));
      } else if (type === 'sos.resolved') {
        const { sos } = data;
        if (!sos) return;

        setActiveAlerts((prev) => prev.filter((x) => x.id !== sos.id));
        setModalAlert((current) => (current && current.id === sos.id ? { ...current, ...sos } : current));
        window.dispatchEvent(new Event('kavach-refresh-counts'));
        toast.info(`SOS for ${sos.name} marked resolved.`);
      }
    },
    [notifyDesktop, toast],
  );

  // Setup stream connection & polling safety net
  useEffect(() => {
    if (!admin) {
      streamRef.current?.stop();
      streamRef.current = null;
      setStreamStatus('disconnected');
      return undefined;
    }

    fetchActive();

    const stream = new SosStream({
      onEvent: handleStreamEvent,
      onStatus: (st) => {
        setStreamStatus(st);
        if (st === 'connected') {
          fetchActive();
        }
      },
    });

    streamRef.current = stream;
    stream.start();

    // 20-second polling fallback
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchActive();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollTimer);
      stream.stop();
      streamRef.current = null;
      stopSiren();
    };
  }, [admin, fetchActive, handleStreamEvent]);

  // Acknowledge SOS
  const acknowledgeAlert = useCallback(
    async (id, note = '') => {
      try {
        const updated = await api(`/admin/sos/${id}/acknowledge`, {
          method: 'POST',
          body: { note: note || null },
        });
        toast.success('Marked as responded. Student notified.');
        setActiveAlerts((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
        setModalAlert((current) => (current && current.id === id ? { ...current, ...updated } : current));
        window.dispatchEvent(new Event('kavach-refresh-counts'));
        return updated;
      } catch (err) {
        toast.error(err.message || 'Failed to acknowledge alert');
        throw err;
      }
    },
    [toast],
  );

  // Resolve SOS
  const resolveAlert = useCallback(
    async (id, note = '') => {
      try {
        const updated = await api(`/admin/sos/${id}/resolve`, {
          method: 'POST',
          body: { note: note || null },
        });
        toast.success('SOS alert closed.');
        setActiveAlerts((prev) => prev.filter((x) => x.id !== id));
        if (modalAlert?.id === id) {
          setModalAlert(null);
        }
        window.dispatchEvent(new Event('kavach-refresh-counts'));
        return updated;
      } catch (err) {
        toast.error(err.message || 'Failed to close alert');
        throw err;
      }
    },
    [modalAlert, toast],
  );

  const value = {
    streamStatus,
    activeAlerts,
    unacknowledgedCount,
    modalAlert,
    setModalAlert,
    sirenEnabled,
    setSirenEnabled,
    muteSiren: stopSiren,
    isSirenActive,
    notificationPerm,
    requestNotifications,
    fetchActive,
    acknowledgeAlert,
    resolveAlert,
  };

  return <SosAlertCtx.Provider value={value}>{children}</SosAlertCtx.Provider>;
}

export const useSosAlert = () => useContext(SosAlertCtx);
