import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const LocationCtx = createContext(null);
const LAST_KEY = 'kavach-last-location';

/**
 * Location is switched on automatically once a student is signed in, so an SOS
 * always has the freshest coordinates available.
 */
export function LocationProvider({ children, enabled }) {
  const [coords, setCoords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch { return null; }
  });
  const [status, setStatus] = useState('idle'); // idle | locating | ok | denied | unavailable | unsupported
  const watchId = useRef(null);

  const accept = useCallback((pos) => {
    const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp || Date.now() };
    setCoords(c);
    setStatus('ok');
    localStorage.setItem(LAST_KEY, JSON.stringify(c));
    return c;
  }, []);

  const reject = useCallback((err) => {
    setStatus(err.code === 1 ? 'denied' : 'unavailable');
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) { setStatus('unsupported'); return; }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setStatus((s) => (s === 'ok' ? s : 'locating'));
    watchId.current = navigator.geolocation.watchPosition(accept, reject, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 });
  }, [accept, reject]);

  useEffect(() => {
    if (!enabled) return undefined;
    start();
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [enabled, start]);

  /** Ask for a fresh fix (used at the moment an SOS is sent), falling back to the last known one. */
  const getFresh = useCallback((timeoutMs = 6000) => new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(coords);
    let done = false;
    const timer = setTimeout(() => { done = true; resolve(coords); }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (!done) { clearTimeout(timer); done = true; resolve(accept(pos)); } },
      () => { if (!done) { clearTimeout(timer); done = true; resolve(coords); } },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: timeoutMs },
    );
  }), [accept, coords]);

  const value = useMemo(() => ({ coords, status, retry: start, getFresh }), [coords, status, start, getFresh]);
  return <LocationCtx.Provider value={value}>{children}</LocationCtx.Provider>;
}

export const useGeo = () => useContext(LocationCtx);
