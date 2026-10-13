import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ShieldCheck, Siren } from 'lucide-react';
import { useSos } from '../context/SosContext';
import { timeAgo } from '../lib/format';

export function ActiveSosBanner() {
  const { activeSos, markSafe, reopenOverlay } = useSos();
  const [markingSafe, setMarkingSafe] = useState(false);
  const navigate = useNavigate();

  if (!activeSos) return null;

  const handleSafe = async (e) => {
    e.stopPropagation();
    if (markingSafe) return;
    setMarkingSafe(true);
    try {
      await markSafe();
    } finally {
      setMarkingSafe(false);
    }
  };

  const handleClick = () => {
    if (reopenOverlay) {
      reopenOverlay();
    } else {
      navigate('/app/sos');
    }
  };

  const isAck = Boolean(activeSos.acknowledged_at);

  return (
    <div
      role="alert"
      onClick={handleClick}
      className="sticky top-0 z-40 cursor-pointer border-b border-signal/40 bg-gradient-to-r from-[#991B1B] via-[#7F1D1D] to-[#18181B] text-white shadow-lg transition-all hover:brightness-110"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-signal/25 text-white animate-pulse border border-signal/40">
            <Siren className="h-5 w-5 text-signal" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-tag bg-signal px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-white shadow-sm">
                Active SOS Alert
              </span>
              <span className="text-xs font-bold text-white/70">
                Triggered {timeAgo(activeSos.created_at)}
              </span>
            </div>
            {isAck ? (
              <p className="flex items-center gap-1.5 truncate text-xs font-bold text-neem mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Security Responding: {activeSos.admin_note || 'Campus security is en route.'}
              </p>
            ) : (
              <p className="truncate text-xs text-white/85 mt-0.5">
                Live GPS broadcasting to emergency contacts & campus security.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleSafe}
            disabled={markingSafe}
            className="flex h-8 items-center gap-1.5 rounded-control bg-white px-3.5 text-xs font-black uppercase tracking-wider text-[#561C2A] shadow-md hover:bg-white/95 active:scale-95 transition-all disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#188358]" />
            {markingSafe ? 'Updating…' : "I'm safe now"}
          </button>
          <span className="hidden sm:inline text-white/50">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}
