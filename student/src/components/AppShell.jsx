import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { HandCoins, Home, MessagesSquare, Mic, Siren, UserRound, Users, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSos } from '../context/SosContext';
import { useOnline } from '../hooks/useOnline';
import { Logo } from './Logo';
import { NotificationsBell } from './NotificationsPanel';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './ui';

const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/community', label: 'Community', icon: Users },
  { to: '/app/sos', label: 'SOS', icon: Siren, sos: true },
  { to: '/app/fundraisers', label: 'Fundraisers', icon: HandCoins },
  { to: '/app/chat', label: 'Ask', icon: MessagesSquare },
];

export default function AppShell() {
  const { user } = useAuth();
  const { voiceOn, voice } = useSos();
  const online = useOnline();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="px-2"><Logo /></div>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end, sos }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex h-11 items-center gap-3 rounded-control px-3 font-bold transition-colors ${
                sos ? (isActive ? 'bg-signal text-white' : 'text-signal hover:bg-signal/10')
                  : isActive ? 'bg-ink text-bg' : 'text-muted hover:bg-raised hover:text-ink'}`}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
          <NavLink to="/app/profile"
            className={({ isActive }) => `mt-auto flex items-center gap-3 rounded-control px-2 py-2 transition-colors ${isActive ? 'bg-raised' : 'hover:bg-raised'}`}>
            <Avatar name={user?.name} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{user?.name}</span>
              <span className="block truncate text-xs text-muted">{user?.regd_no || user?.email || user?.phone}</span>
            </span>
          </NavLink>
        </nav>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <div className="lg:hidden"><Logo compact /></div>
          <div className="flex-1" />
          {voiceOn && voice.supported && (
            <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex ${voice.listening ? 'bg-signal/10 text-signal' : 'bg-raised text-muted'}`} title="Say “help” to start an SOS">
              <Mic className="h-3.5 w-3.5" /> {voice.listening ? 'Listening for “help”' : 'Voice SOS paused'}
            </span>
          )}
          <ThemeToggle />
          <NotificationsBell />
          <NavLink to="/app/profile" className="ml-1 lg:hidden" aria-label="Profile"><Avatar name={user?.name} size={34} /></NavLink>
          <NavLink to="/app/profile" className="hidden lg:inline-flex" aria-label="Profile"><UserRound className="h-5 w-5 text-muted" /></NavLink>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-brass px-4 py-1.5 text-center text-sm font-bold text-white">
            <WifiOff className="h-4 w-4" /> Offline: showing saved data. SOS will open your SMS app.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-5 lg:pb-12" key={pathname.split('/')[2] || 'home'}>
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden safe-bottom" aria-label="Main">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end, sos }) => (
            <NavLink key={to} to={to} end={end} className="flex flex-col items-center justify-center" aria-label={label}>
              {({ isActive }) => (sos ? (
                <span className={`-mt-7 flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-bg bg-signal text-white shadow-sos ${isActive ? 'ring-4 ring-signal/25' : ''}`}>
                  <Icon className="h-6 w-6" />
                  <span className="text-[10px] font-extrabold">SOS</span>
                </span>
              ) : (
                <>
                  <Icon className={`h-[22px] w-[22px] ${isActive ? 'text-ink' : 'text-muted'}`} strokeWidth={isActive ? 2.4 : 2} />
                  <span className={`mt-0.5 text-[11px] font-bold ${isActive ? 'text-ink' : 'text-muted'}`}>{label}</span>
                </>
              ))}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
