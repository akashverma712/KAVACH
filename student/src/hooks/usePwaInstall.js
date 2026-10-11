import { useEffect, useState } from 'react';

let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l(false)); });
}

/** Exposes the browser's "Install app" prompt (Chrome/Edge/Android). */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(Boolean(deferred));
  useEffect(() => {
    listeners.add(setCanInstall);
    return () => listeners.delete(setCanInstall);
  }, []);
  const install = async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setCanInstall(false);
    return outcome === 'accepted';
  };
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);
  return { canInstall, install, standalone };
}
