import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = {
  success: 'border-neem/40 [&_svg.t-icon]:text-neem',
  error: 'border-signal/40 [&_svg.t-icon]:text-signal',
  info: 'border-line [&_svg.t-icon]:text-ink',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);

  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);
  const push = useCallback((type, message, ms = 4500) => {
    id.current += 1;
    const tid = id.current;
    setToasts((t) => [...t.slice(-3), { id: tid, type, message }]);
    setTimeout(() => dismiss(tid), ms);
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m, 6000),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[1200] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} role="status" className={`pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-control border bg-surface px-4 py-3 text-[15px] shadow-float ${TONES[t.type]}`}>
              <Icon className="t-icon mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
