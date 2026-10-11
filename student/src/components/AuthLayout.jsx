import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-night p-10 text-white lg:flex lg:flex-col">
        <Link to="/" className="inline-flex items-center gap-2.5 [&_rect]:fill-white [&_path]:stroke-[#13213C]">
          <Logo />
        </Link>
        <div className="mt-auto max-w-sm">
          <p className="font-display text-3xl font-extrabold leading-tight">Your safety net on campus, from the first day to the last.</p>
          <p className="mt-4 text-white/70">Kavach is only for BIT Sindri students. Your phone number and email are never shown to other students.</p>
        </div>
        <div className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full border border-white/10" aria-hidden />
        <div className="pointer-events-none absolute -right-8 top-[42%] h-48 w-48 rounded-full border border-white/10" aria-hidden />
        <div className="pointer-events-none absolute right-12 top-[50%] h-16 w-16 rounded-full bg-signal" aria-hidden />
      </aside>
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link to="/" className="lg:invisible"><Logo /></Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-[15px] text-muted">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
