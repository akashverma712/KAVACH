import { forwardRef, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { initials } from '../lib/format';

const cx = (...a) => a.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-ink text-bg hover:bg-ink/90 disabled:bg-ink/50',
  danger: 'bg-signal text-white hover:bg-signal/90 disabled:bg-signal/50',
  success: 'bg-neem text-white hover:bg-neem/90 dark:text-night',
  outline: 'border border-line bg-surface text-ink hover:border-ink/40',
  ghost: 'text-ink hover:bg-ink/5 dark:hover:bg-white/5',
  subtle: 'bg-raised text-ink hover:bg-line/60',
};
const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-10 w-10',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-control font-bold transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={cx('animate-spin text-muted', className)} aria-label="Loading" />;

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-7 w-7" /></div>;
}

export function Field({ label, hint, error, children, id, optional }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label">
          {label} {optional && <span className="font-normal text-muted">(optional)</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1.5 text-[13px] font-bold text-signal" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, hint, error, optional, className, id, icon: Icon, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" aria-hidden />}
        <input ref={ref} id={fid} aria-invalid={Boolean(error)} className={cx('field-input', Icon && 'pl-10', error && 'border-signal/60', className)} {...rest} />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, optional, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional}>
      <textarea ref={ref} id={fid} aria-invalid={Boolean(error)} className={cx('field-input min-h-[110px] resize-y', error && 'border-signal/60', className)} {...rest} />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, className, id, children, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid}>
      <select ref={ref} id={fid} className={cx('field-input appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10', className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23788aa6' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
        {...rest}>
        {children}
      </select>
    </Field>
  );
});

const TONES = {
  signal: 'bg-signal/10 text-signal',
  neem: 'bg-neem/15 text-neem',
  brass: 'bg-brass/15 text-brass',
  ink: 'bg-ink/10 text-ink',
  muted: 'bg-muted/15 text-muted',
};
export function Badge({ tone = 'muted', className, children, dot }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 40, className }) {
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-bg', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && <Icon className="mb-4 h-10 w-10 text-muted/70" strokeWidth={1.5} aria-hidden />}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md', labelledBy }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input,textarea,select,button:not([data-close])')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[1050] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId}>
      <button type="button" data-close className="absolute inset-0 bg-night/55 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div ref={ref} className={cx('relative flex max-h-[92vh] w-full animate-rise flex-col rounded-t-panel bg-surface shadow-float sm:rounded-panel', width)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" data-close onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Close dialog"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 safe-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented({ value, onChange, options, className, label }) {
  return (
    <div role="tablist" aria-label={label} className={cx('inline-flex rounded-control bg-raised p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('h-9 rounded-[0.55rem] px-3.5 text-sm font-bold transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, children, ...rest }) {
  return (
    <button type="button" aria-pressed={active}
      className={cx('h-8 shrink-0 rounded-full border px-3 text-[13.5px] font-bold transition-colors',
        active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink')}
      {...rest}>
      {children}
    </button>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-control bg-line/60', className)} />;
}
