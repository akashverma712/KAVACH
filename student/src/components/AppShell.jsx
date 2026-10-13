import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { HandCoins, Home, MessagesSquare, Mic, Siren, UserRound, Users, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSos } from '../context/SosContext';
import { useOnline } from '../hooks/useOnline';
import { ActiveSosBanner } from './ActiveSosBanner';
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
  const { voiceOn, voiceGuard } = useSos();
  const online = useOnline();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen lg:pl-64 bg-bg text-ink">
      {/* Desktop Navigation Rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/95 backdrop-blur-md px-4 py-5 lg:flex shadow-sm">
        <div className="px-2 pt-1 pb-2">
          <Logo />
        </div>

        {/* Section divider with subtle stepped geometry */}
        <div className="my-4 h-px w-full bg-line/60" />

        <nav className="flex flex-1 flex-col gap-1.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end, sos }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex h-11 items-center gap-3 rounded-control px-3.5 text-sm font-extrabold uppercase tracking-wide transition-all ${
                  sos
                    ? isActive
                      ? 'bg-signal text-white shadow-sos'
                      : 'text-signal bg-signal/10 hover:bg-signal/20'
                    : isActive
                    ? 'bg-ink text-bg shadow-sm'
                    : 'text-muted hover:bg-raised hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
                  {isActive && !sos && (
                    <span className="ml-auto h-2 w-2 rounded-[2px] bg-glacial" />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* User profile dock in desktop sidebar */}
          <NavLink
            to="/app/profile"
            className={({ isActive }) =>
              `mt-auto flex items-center gap-3 rounded-control border p-2 transition-all ${
                isActive
                  ? 'border-glacial bg-glacial/10 text-ink'
                  : 'border-line/70 bg-raised/50 hover:bg-raised text-muted hover:text-ink'
              }`
            }
          >
            <Avatar name={user?.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black uppercase tracking-wider text-ink">
                {user?.name}
              </span>
              <span className="block truncate text-[11px] font-bold text-muted">
                {user?.regd_no || user?.email || user?.phone}
              </span>
            </span>
          </NavLink>
        </nav>
      </aside>

      {/* Top Header */}
      <header
        className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="flex-1" />

          {/* Voice trigger status pill */}
          {voiceOn && voiceGuard?.supported && (
            <span
              className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold tracking-wide sm:inline-flex border ${
                voiceGuard.listening
                  ? 'border-signal/40 bg-signal/15 text-signal animate-pulse'
                  : 'border-line bg-raised text-muted'
              }`}
              title="Say “help” or “bachao” to start an SOS"
            >
              <Mic className="h-3.5 w-3.5 shrink-0" />
              {voiceGuard.listening ? 'Voice Guard Active' : 'Voice SOS Paused'}
            </span>
          )}

          <ThemeToggle />
          <NotificationsBell />

          <NavLink to="/app/profile" className="ml-1 lg:hidden" aria-label="Profile">
            <Avatar name={user?.name} size={34} />
          </NavLink>
          <NavLink
            to="/app/profile"
            className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-control hover:bg-raised text-muted hover:text-ink"
            aria-label="Profile"
          >
            <UserRound className="h-5 w-5" />
          </NavLink>
        </div>

        {/* Offline indicator banner */}
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-brass px-4 py-1.5 text-center text-xs font-black uppercase tracking-wider text-white shadow-inner">
            <WifiOff className="h-4 w-4 shrink-0" />
            Offline Mode: Showing cached data · SOS will automatically trigger SMS
          </div>
        )}
      </header>

      {/* Active SOS notification banner across all routes */}
      <ActiveSosBanner />

      {/* Main page view */}
      <main
        className="mx-auto max-w-5xl px-4 pb-32 pt-6 lg:pb-14"
        key={pathname.split('/')[2] || 'home'}
      >
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Dock */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden safe-bottom shadow-float"
        aria-label="Main"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end, sos }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex flex-col items-center justify-center"
              aria-label={label}
            >
              {({ isActive }) =>
                sos ? (
                  <span
                    className={`-mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-bg bg-gradient-to-b from-[#FA4D41] to-[#BD1E13] text-white shadow-sos transition-transform active:scale-95 ${
                      isActive ? 'ring-4 ring-signal/30' : ''
                    }`}
                  >
                    <Icon className="h-6 w-6 shrink-0 drop-shadow" />
                    <span className="text-[10px] font-black tracking-wider uppercase">SOS</span>
                  </span>
                ) : (
                  <>
                    <Icon
                      className={`h-5 w-5 transition-colors ${
                        isActive ? 'text-glacial' : 'text-muted'
                      }`}
                      strokeWidth={isActive ? 2.5 : 1.75}
                    />
                    <span
                      className={`mt-1 text-[10.5px] font-extrabold uppercase tracking-wider transition-colors ${
                        isActive ? 'text-ink' : 'text-muted'
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
