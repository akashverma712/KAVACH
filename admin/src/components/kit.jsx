import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './ui';

export function PageHeader({ title, children, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] font-extrabold">{title}</h1>
        {children && <p className="mt-0.5 max-w-2xl text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <p className="text-muted">{(page - 1) * limit + 1} to {Math.min(total, page * limit)} of {total}</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2 font-bold">{page} / {pages}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/** Slide-over panel used for record details. */
export function Drawer({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1040] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-night/50" onClick={onClose} aria-label="Close" />
      <div className={`relative flex h-full w-full flex-col bg-surface shadow-float ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Close panel"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Th({ children, className = '' }) {
  return <th scope="col" className={`whitespace-nowrap px-4 py-3 text-left text-[13px] font-bold text-muted ${className}`}>{children}</th>;
}
export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function TableShell({ children, footer }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-[15px]">{children}</table></div>
      {footer}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  const color = { signal: 'text-signal', brass: 'text-brass', neem: 'text-neem' }[tone] || 'text-ink';
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-extrabold tabular-nums ${color}`}>{value ?? '–'}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
