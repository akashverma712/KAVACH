const KEY = 'kavach-admin-theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export const getThemePref = () => localStorage.getItem(KEY) || 'system';

export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1628' : '#13213C');
  return dark;
}

export function setThemePref(pref) {
  localStorage.setItem(KEY, pref);
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent('kavach-admin-theme', { detail: pref }));
}

export function watchSystemTheme() {
  const m = media();
  const fn = () => getThemePref() === 'system' && applyTheme('system');
  m.addEventListener?.('change', fn);
  return () => m.removeEventListener?.('change', fn);
}
