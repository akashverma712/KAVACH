import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => api('/me/notifications').then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 60_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read_at) api(`/me/notifications/${n.id}/read`, { method: 'POST' }).then(load).catch(() => {});
    if (n.link) navigate(n.link);
  };
  const readAll = async () => {
    await api('/me/notifications/read-all', { method: 'POST' }).catch(() => {});
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 dark:hover:bg-white/5"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-signal px-1 text-[11px] font-bold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] animate-rise overflow-hidden rounded-panel border border-line bg-surface shadow-float">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-bold">Notifications</h2>
            {data.unread > 0 && (
              <button type="button" onClick={readAll} className="flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"><CheckCheck className="h-4 w-4" /> Mark all read</button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-10 text-center text-muted">Updates on your problems and fundraisers will show up here.</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left hover:bg-raised">
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-signal'}`} aria-hidden />
                  <span className="min-w-0">
                    <span className={`block ${n.read_at ? '' : 'font-bold'}`}>{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-sm text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
