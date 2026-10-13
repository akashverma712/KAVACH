import { forwardRef, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { initials } from '../lib/format';

const cx = (...a) => a.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary:
    'bg-ink text-bg font-extrabold hover:bg-ink/90 active:translate-y-[1px] shadow-sm disabled:bg-ink/40 disabled:text-bg/60',
  danger:
    'bg-signal text-white font-extrabold hover:bg-signal/90 active:translate-y-[1px] shadow-sm shadow-signal/20 disabled:bg-signal/40',
  success:
    'bg-neem text-white font-extrabold hover:bg-neem/90 active:translate-y-[1px] shadow-sm shadow-neem/20 dark:text-night',
  glacial:
    'bg-glacial text-white font-extrabold hover:bg-glacial/90 active:translate-y-[1px] dark:text-night',
  outline:
    'border border-line bg-surface text-ink font-bold hover:border-glacial/60 hover:bg-raised active:translate-y-[1px]',
  ghost:
    'text-ink font-bold hover:bg-line/40 active:translate-y-[1px]',
  subtle:
    'bg-raised text-ink font-bold hover:bg-line/60 active:translate-y-[1px]',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-control',
  md: 'h-10 px-4 text-sm gap-2 rounded-control',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-control',
  icon: 'h-10 w-10 rounded-control',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center transition-all duration-150 focus-visible:ring-2 focus-visible:ring-glacial disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />}
      {children}
    </button>
  );
});

export const Spinner = ({ className = 'h-5 w-5' }) => (
  <Loader2 className={cx('animate-spin text-muted', className)} aria-label="Loading" />
);

export function PageLoader() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8 text-signal" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Loading Kavach…
        </span>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, id, optional }) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="label">
          {label} {optional && <span className="font-normal normal-case text-muted">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-signal" role="alert">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, optional, className, id, icon: Icon, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional}>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={fid}
          aria-invalid={Boolean(error)}
          className={cx(
            'field-input',
            Icon && 'pl-10',
            error && 'border-signal ring-2 ring-signal/20',
            className,
          )}
          {...rest}
        />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, optional, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional}>
      <textarea
        ref={ref}
        id={fid}
        aria-invalid={Boolean(error)}
        className={cx(
          'field-input min-h-[110px] resize-y',
          error && 'border-signal ring-2 ring-signal/20',
          className,
        )}
        {...rest}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid}>
      <select
        ref={ref}
        id={fid}
        className={cx(
          'field-input appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2396B6A8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});

const TONES = {
  signal: 'bg-signal/15 text-signal border-signal/30',
  neem: 'bg-neem/15 text-neem border-neem/30',
  brass: 'bg-brass/15 text-brass border-brass/30',
  glacial: 'bg-glacial/15 text-glacial border-glacial/30',
  maroon: 'bg-maroon/20 text-maroon border-maroon/30 dark:text-rose-300',
  ink: 'bg-ink/10 text-ink border-ink/20',
  muted: 'bg-muted/15 text-muted border-line',
};

export function Badge({ tone = 'muted', className, children, dot }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-tag border px-2 py-0.5 text-[11.5px] font-extrabold uppercase tracking-wider',
        TONES[tone] || TONES.muted,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-subtle" aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 40, className }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-control bg-raised border border-line font-display font-black text-ink shadow-sm',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-panel border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-control bg-raised border border-line text-muted">
          <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-muted">{children}</p>}
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
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(
      () => ref.current?.querySelector('input,textarea,select,button:not([data-close])')?.focus(),
      30,
    );
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-[1050] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy || titleId}
    >
      <button
        type="button"
        data-close
        className="absolute inset-0 bg-night/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        ref={ref}
        className={cx(
          'relative flex max-h-[92vh] w-full animate-rise flex-col rounded-t-panel border border-line bg-surface shadow-float sm:rounded-panel',
          width,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-extrabold text-ink">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="rounded-control p-1.5 text-muted hover:bg-raised hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 safe-bottom bg-raised/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented({ value, onChange, options, className, label }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx('inline-flex rounded-control border border-line bg-raised p-1 gap-1', className)}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-8 rounded-[0.45rem] px-3.5 text-xs font-extrabold uppercase tracking-wider transition-all',
              active
                ? 'bg-surface text-ink shadow-sm border border-line/60'
                : 'text-muted hover:text-ink hover:bg-surface/50',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'h-8 shrink-0 rounded-control border px-3 text-xs font-bold transition-all',
        active
          ? 'border-glacial bg-glacial/15 text-glacial dark:text-glacial'
          : 'border-line bg-surface text-muted hover:border-line/80 hover:text-ink',
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className }) {
  return (
    <div
      className={cx(
        'animate-pulse rounded-control bg-line/60 dark:bg-raised/80',
        className,
      )}
    />
  );
}
