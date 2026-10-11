/**
 * The signature SOS control: a signal-red disc with slow concentric rings.
 * Used as the real SOS button inside the app and as a demo on the landing page.
 */
export function Beacon({ onPress, size = 220, label = 'SOS', sub = 'Tap to alert', disabled, ariaLabel, quiet = false }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size * 1.55, height: size * 1.55 }}>
      {!quiet && !disabled && (
        <>
          <span className="absolute rounded-full bg-signal/25 animate-ring" style={{ width: size, height: size }} aria-hidden />
          <span className="absolute rounded-full bg-signal/20 animate-ring [animation-delay:1.3s]" style={{ width: size, height: size }} aria-hidden />
        </>
      )}
      <span className="absolute rounded-full border border-signal/25" style={{ width: size * 1.28, height: size * 1.28 }} aria-hidden />
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={ariaLabel || `${label}. ${sub}`}
        className="relative flex flex-col items-center justify-center rounded-full bg-signal text-white shadow-sos transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ width: size, height: size }}
      >
        <span className="absolute inset-[7%] rounded-full border-2 border-white/25" aria-hidden />
        <span className="font-display font-extrabold leading-none tracking-tight" style={{ fontSize: size * 0.3 }}>{label}</span>
        <span className="mt-1.5 font-bold text-white/85" style={{ fontSize: Math.max(12, size * 0.068) }}>{sub}</span>
      </button>
    </div>
  );
}
