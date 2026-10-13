/**
 * The signature SOS Beacon control:
 * A constructivist tactile beacon with concentric radar rings,
 * vibrant coral-vermillion gradient, and high-contrast typography.
 */
export function Beacon({
  onPress,
  size = 220,
  label = 'SOS',
  sub = 'Tap to alert',
  disabled,
  ariaLabel,
  quiet = false,
}) {
  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size * 1.6, height: size * 1.6 }}
    >
      {/* Animated concentric acoustic shockwaves */}
      {!quiet && !disabled && (
        <>
          <span
            className="absolute rounded-full bg-[#FF3B30]/25 animate-ping [animation-duration:2.5s]"
            style={{ width: size * 1.05, height: size * 1.05 }}
            aria-hidden
          />
          <span
            className="absolute rounded-full border border-[#FF3B30]/30 animate-pulse [animation-duration:1.8s]"
            style={{ width: size * 1.25, height: size * 1.25 }}
            aria-hidden
          />
        </>
      )}

      {/* Outer tactile titanium precision bezel with crosshair ticks */}
      <div
        className="pointer-events-none absolute rounded-full border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02]"
        style={{ width: size * 1.34, height: size * 1.34 }}
        aria-hidden
      >
        {/* Subtle geometric calibration ticks */}
        <span className="absolute -top-1 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-[#FF3B30]/60" />
        <span className="absolute -bottom-1 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-[#FF3B30]/60" />
        <span className="absolute -left-1 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-[#FF3B30]/60" />
        <span className="absolute -right-1 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-[#FF3B30]/60" />
      </div>

      {/* Mid boundary ring */}
      <span
        className="pointer-events-none absolute rounded-full border border-dashed border-[#FF3B30]/30"
        style={{ width: size * 1.18, height: size * 1.18 }}
        aria-hidden
      />

      {/* Main interactive Beacon button */}
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={ariaLabel || `${label}. ${sub}`}
        className="group relative flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#FF453A] via-[#FF3B30] to-[#D70015] text-white shadow-[0_12px_36px_-6px_rgba(255,59,48,0.45)] transition-all duration-150 active:scale-[0.94] active:shadow-[0_4px_16px_rgba(255,59,48,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale-[0.4]"
        style={{ width: size, height: size }}
      >
        {/* Top glossy specular reflection bezel */}
        <span
          className="pointer-events-none absolute inset-[4%] rounded-full border border-white/40 bg-gradient-to-b from-white/30 via-transparent to-black/20"
          aria-hidden
        />

        {/* Center label */}
        <span
          className="relative font-display font-black leading-none tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          style={{ fontSize: size * 0.32 }}
        >
          {label}
        </span>

        {/* Secondary helper text */}
        <span
          className="relative mt-2 rounded-full bg-black/30 border border-white/20 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-white backdrop-blur-sm"
          style={{ fontSize: Math.max(11, size * 0.065) }}
        >
          {sub}
        </span>
      </button>
    </div>
  );
}
