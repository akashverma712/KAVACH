import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bot, Flag, GraduationCap, HandCoins, LayoutDashboard, LogOut, Menu, MessageSquareWarning, Settings, Siren, UserCog, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/sos', label: 'SOS alerts', icon: Siren, badge: 'sos_unacknowledged', urgent: true },
  { to: '/problems', label: 'Problems', icon: MessageSquareWarning, badge: 'open_problems' },
  { to: '/reports', label: 'Reports', icon: Flag, badge: 'pending_reports', urgent: true },
  { to: '/fundraisers', label: 'Fundraisers', icon: HandCoins, badge: 'pending_fundraisers' },
  { to: '/students', label: 'Student roster', icon: GraduationCap },
  { to: '/users', label: 'Accounts', icon: UserCog },
  { to: '/chatbot', label: 'Chatbot answers', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({});
  const { pathname } = useLocation();

  const loadStats = useCallback(() => api('/admin/dashboard').then((d) => setStats(d.stats)).catch(() => {}), []);
  useEffect(() => {
    loadStats();
    const t = setInterval(() => document.visibilityState === 'visible' && loadStats(), 30_000);
    window.addEventListener('kavach-refresh-counts', loadStats);
    return () => { clearInterval(t); window.removeEventListener('kavach-refresh-counts', loadStats); };
  }, [loadStats]);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin">
      {NAV.map(({ to, label, icon: Icon, end, badge, urgent }) => {
        const n = badge ? stats[badge] : 0;
        return (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex h-10 items-center gap-3 rounded-control px-3 text-[15px] font-bold transition-colors ${isActive ? 'bg-ink text-bg' : 'text-muted hover:bg-raised hover:text-ink'}`}>
            <Icon className="h-[18px] w-[18px]" /> <span className="flex-1">{label}</span>
            {n > 0 && <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11.5px] font-bold ${urgent ? 'bg-signal text-white' : 'bg-line text-ink'}`}>{n > 99 ? '99+' : n}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="mb-7 px-2"><Logo /></div>
        {nav}
        <div className="mt-4 flex items-center gap-2.5 border-t border-line px-2 pt-4">
          <Avatar name={admin?.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{admin?.name}</p>
            <p className="truncate text-xs text-muted">{admin?.email}</p>
          </div>
          <button type="button" onClick={() => logout()} className="rounded-full p-2 text-muted hover:bg-raised hover:text-signal" aria-label="Sign out"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-night/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="relative flex h-full w-72 flex-col bg-surface px-3 py-5">
            <div className="mb-6 flex items-center justify-between px-2"><Logo /><button type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            {nav}
            <button type="button" onClick={() => logout()} className="mt-4 flex h-10 items-center gap-3 rounded-control px-3 font-bold text-signal hover:bg-signal/10"><LogOut className="h-[18px] w-[18px]" /> Sign out</button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur lg:px-8">
        <button type="button" className="rounded-full p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <div className="lg:hidden"><Logo compact /></div>
        <div className="flex-1" />
        {stats.sos_unacknowledged > 0 && (
          <NavLink to="/sos" className="mr-1 inline-flex h-9 items-center gap-2 rounded-full bg-signal px-3.5 text-sm font-bold text-white">
            <Siren className="h-4 w-4" /> {stats.sos_unacknowledged} SOS need a response
          </NavLink>
        )}
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 lg:px-8"><Outlet context={{ refreshCounts: loadStats }} /></main>
    </div>
  );
}
