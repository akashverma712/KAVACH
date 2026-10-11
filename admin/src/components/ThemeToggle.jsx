import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemePref, setThemePref } from '../lib/theme';

const ORDER = ['light', 'dark', 'system'];
const ICON = { light: Sun, dark: Moon, system: Monitor };
const LABEL = { light: 'Light', dark: 'Dark', system: 'System' };

export function useThemePref() {
  const [pref, setPref] = useState(getThemePref);
  useEffect(() => {
    const fn = (e) => setPref(e.detail);
    window.addEventListener('kavach-admin-theme', fn);
    return () => window.removeEventListener('kavach-admin-theme', fn);
  }, []);
  return [pref, (p) => { setThemePref(p); setPref(p); }];
}

export function ThemeToggle({ className = '' }) {
  const [pref, setPref] = useThemePref();
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = ICON[pref];
  return (
    <button type="button" onClick={() => setPref(next)}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/5 dark:hover:bg-white/5 ${className}`}
      aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[next]}`} title={`Theme: ${LABEL[pref]}`}>
      <Icon className="h-5 w-5" />
    </button>
  );
}

export function ThemeSelector() {
  const [pref, setPref] = useThemePref();
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
      {ORDER.map((p) => {
        const Icon = ICON[p];
        const active = pref === p;
        return (
          <button key={p} type="button" role="radio" aria-checked={active} onClick={() => setPref(p)}
            className={`flex flex-col items-center gap-1.5 rounded-control border py-3 text-sm font-bold transition-colors ${active ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:text-ink'}`}>
            <Icon className="h-5 w-5" /> {LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}
