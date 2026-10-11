import { useEffect, useRef } from 'react';

/** Six boxes for a 6-digit code; supports paste, backspace navigation and SMS autofill (one-time-code). */
export function OtpInput({ value, onChange, disabled, autoFocus = true, invalid }) {
  const refs = useRef([]);
  const focus = (i) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  useEffect(() => { if (autoFocus) focus(0); }, [autoFocus]);

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    const start = Math.min(i, value.length);
    const next = (value.slice(0, start) + raw + value.slice(start + raw.length)).slice(0, 6);
    onChange(next);
    focus(start + raw.length);
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); focus(i - 1); }
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text) { e.preventDefault(); onChange(text); focus(text.length); }
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste} role="group" aria-label="Verification code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          className={`h-14 w-full min-w-0 rounded-control border bg-surface text-center font-display text-2xl font-bold text-ink focus:outline-none focus:ring-4 focus:ring-ink/10 ${invalid ? 'border-signal' : 'border-line focus:border-ink/50'}`}
        />
      ))}
    </div>
  );
}
