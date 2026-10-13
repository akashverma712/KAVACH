export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="appleLogoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2C2C2E" />
          <stop offset="1" stopColor="#1C1C1E" />
        </linearGradient>
        <linearGradient id="appleBeaconGrad" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF453A" />
          <stop offset="1" stopColor="#D70015" />
        </linearGradient>
      </defs>
      {/* Precision titanium chassis */}
      <rect width="64" height="64" rx="16" fill="url(#appleLogoGrad)" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Concentric radar beacon rings */}
      <circle cx="32" cy="32" r="20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="14" stroke="rgba(255,69,58,0.35)" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* Glowing emergency core */}
      <circle cx="32" cy="32" r="8" fill="url(#appleBeaconGrad)" />
      <circle cx="32" cy="32" r="3" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
}

export function Logo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <LogoMark className="h-8 w-8 shrink-0 drop-shadow-sm" />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[18px] font-black tracking-tight text-ink">
            Kavach
          </span>
          <span className="block text-[10px] font-bold tracking-widest text-muted uppercase">
            BIT Sindri
          </span>
        </span>
      )}
    </span>
  );
}
