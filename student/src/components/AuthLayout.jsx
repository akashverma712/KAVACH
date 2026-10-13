import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5.2fr)_minmax(0,6fr)] bg-bg">
      {/* Apple Space Black & Titanium Sidebar */}
      <aside className="relative hidden overflow-hidden bg-[#0A0A0C] p-12 text-white lg:flex lg:flex-col border-r border-white/10">
        {/* Subtle grid texture */}
        <div className="pointer-events-none absolute inset-0 bg-grid-tactile opacity-20" />

        {/* Brand header */}
        <div className="relative z-10">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
        </div>

        {/* Precision Hardware & Telemetry Visual Art */}
        <div className="relative my-auto py-10" aria-hidden="true">
          <div className="relative h-64 w-full max-w-sm">
            {/* Sapphire blue stepped pixels */}
            <div className="absolute left-6 top-4 flex gap-1.5">
              <span className="h-6 w-6 rounded-[4px] bg-glacial" />
              <span className="h-6 w-6 rounded-[4px] bg-glacial/70" />
              <span className="h-6 w-6 rounded-[4px] bg-glacial/40" />
            </div>

            {/* Stepped white staircase trail */}
            <div className="absolute left-16 top-16 space-y-1.5">
              <span className="block h-5 w-5 rounded-[3px] bg-white translate-x-0" />
              <span className="block h-5 w-5 rounded-[3px] bg-white translate-x-5" />
              <span className="block h-5 w-5 rounded-[3px] bg-white translate-x-10" />
              <span className="block h-5 w-5 rounded-[3px] bg-white translate-x-15" />
            </div>

            {/* Apple Emergency Red fluted bars (SOS indicator) */}
            <div className="absolute right-12 top-6 flex gap-1.5">
              <span className="h-16 w-3 rounded-full bg-signal" />
              <span className="h-24 w-3 rounded-full bg-signal" />
              <span className="h-12 w-3 rounded-full bg-signal" />
              <span className="h-20 w-3 rounded-full bg-signal" />
            </div>

            {/* Amber Ochre diagonal cuts & square */}
            <div className="absolute left-10 bottom-6 flex items-end gap-3">
              <div
                className="h-16 w-16 bg-brass rounded-bl-xl"
                style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }}
              />
              <div className="h-12 w-12 rounded-[6px] bg-brass/90" />
            </div>

            {/* Deep Titanium Grounding Block */}
            <div className="absolute right-14 bottom-4 h-20 w-24 rounded-2xl bg-[#1C1C1E] border border-white/10 p-3 flex flex-col justify-between shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                CAMPUS
              </span>
              <span className="font-display text-xl font-black text-white">
                SHIELD
              </span>
            </div>
          </div>
        </div>

        {/* Value proposition copy */}
        <div className="relative z-10 mt-auto max-w-md">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-widest text-[#2997FF]">
            <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
            BIT SINDRI EMERGENCY SHIELD
          </div>
          <h2 className="font-display text-3xl font-black leading-tight text-white">
            Your safety net on campus, from day one.
          </h2>
          <p className="mt-3 text-sm text-[#8E8E93] leading-relaxed">
            Kavach is exclusively for verified BIT Sindri students. Your phone number and email are securely protected and never broadcast.
          </p>
        </div>
      </aside>

      {/* Auth Content Area */}
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-6 sm:px-10">
          <Link to="/" className="lg:invisible">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-start justify-center px-6 pb-14 pt-4 sm:items-center sm:px-12">
          <div className="w-full max-w-md">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && (
              <div className="mt-8 text-center text-sm text-muted">{footer}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
