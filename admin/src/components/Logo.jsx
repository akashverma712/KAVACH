export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <path d="M32 10 50 17v13c0 11.5-7.6 20.4-18 24-10.4-3.6-18-12.5-18-24V17z" fill="none" className="stroke-bg" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="31" r="7" className="fill-signal" />
    </svg>
  );
}

export function Logo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[19px] font-extrabold tracking-tight">Kavach</span>
          <span className="block text-[11.5px] font-bold text-muted">Admin console</span>
        </span>
      )}
    </span>
  );
}
