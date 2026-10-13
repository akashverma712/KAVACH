import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Mic,
  Phone,
  ShieldCheck,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from './ui';

const COUNTDOWN_TOTAL_MS = 10_000;

export function SosOverlay({
  phase,
  msLeft,
  source,
  transcript,
  result,
  error,
  status,
  activeSos,
  numbers,
  smsHref,
  alarm,
  retryCount = 0,
  voiceMode,
  onCancel,
  onSendNow,
  onClose,
  onMarkSafe,
}) {
  const cancelRef = useRef(null);
  const [safeNote, setSafeNote] = useState('');
  const [markingSafe, setMarkingSafe] = useState(false);
  const [showSafePrompt, setShowSafePrompt] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, [phase, showSafePrompt]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && phase === 'countdown') onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [phase, onCancel]);

  const seconds = Math.ceil(msLeft / 1000);
  const R = 92;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, msLeft / COUNTDOWN_TOTAL_MS));

  const handleSafeSubmit = async (e) => {
    e?.preventDefault();
    if (markingSafe) return;
    setMarkingSafe(true);
    try {
      await onMarkSafe?.(safeNote.trim());
      setShowSafePrompt(false);
    } finally {
      setMarkingSafe(false);
    }
  };

  const isAck = Boolean(activeSos?.acknowledged_at);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-title"
      aria-describedby="sos-desc"
      className={`fixed inset-0 z-[1100] flex flex-col items-center justify-center overflow-y-auto px-6 py-10 text-white transition-colors duration-300 ${
        phase === 'sent'
          ? 'bg-gradient-to-b from-[#1C1C1E] via-[#121214] to-[#0A0A0C]'
          : 'bg-gradient-to-b from-[#3B0712] via-[#1A0508] to-[#0A0A0C]'
      }`}
    >
      {/* ───────────────── COUNTDOWN & SENDING ───────────────── */}
      {(phase === 'countdown' || phase === 'sending') && (
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/80">
            {source === 'voice' ? (
              <>
                <Mic className="h-4 w-4 text-signal" aria-hidden />
                Voice heard: {transcript ? `“${transcript}”` : '“help”'}
              </>
            ) : (
              <>
                <BellRing className="h-4 w-4 text-signal" aria-hidden /> SOS Beacon Triggered
              </>
            )}
          </p>

          <h2 id="sos-title" className="font-display text-3xl font-black tracking-tight text-white">
            {phase === 'sending'
              ? retryCount > 0
                ? `Retrying alert (${retryCount}/4)…`
                : 'Sending your SOS…'
              : 'Dispatching in'}
          </h2>

          <div className="relative my-7 h-56 w-56">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90 drop-shadow-[0_0_20px_rgba(250,77,65,0.4)]" aria-hidden>
              <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="10" />
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="#FA4D41"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                style={{ transition: 'stroke-dashoffset 0.2s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {phase === 'sending' ? (
                <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" aria-label="Sending" />
              ) : (
                <>
                  <span className="font-display text-8xl font-black tabular-nums text-white drop-shadow" aria-live="assertive">
                    {seconds}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest text-white/70">seconds</span>
                </>
              )}
            </div>
          </div>

          <p id="sos-desc" className="mb-4 text-xs font-bold text-white/80">
            Live GPS coordinates will be sent to {numbers?.length || 'your'} emergency contact
            {numbers?.length === 1 ? '' : 's'} and campus security desk.
          </p>

          {phase === 'countdown' && (
            <>
              {voiceMode === 'cancel' && (
                <p className="mb-6 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white">
                  🎙 Say <span className="underline">“cancel”</span> or <span className="underline">“I’m safe”</span> to abort
                </p>
              )}

              <div className="flex w-full flex-col gap-3">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onCancel}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-panel bg-white text-base font-black uppercase tracking-wider text-[#FF3B30] shadow-float hover:bg-white/95 active:scale-[0.98] transition-all"
                >
                  <X className="h-5 w-5" aria-hidden /> Cancel — I'm Safe
                </button>
                <button
                  type="button"
                  onClick={onSendNow}
                  className="h-11 w-full rounded-panel border border-white/30 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 active:scale-[0.98] transition-all"
                >
                  Send Now Without Waiting
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────── SENT & ACTIVE SCREEN ───────────────── */}
      {phase === 'sent' && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="mb-4 flex h-18 w-18 items-center justify-center rounded-full bg-white text-[#0A0A0C] shadow-md">
            <Check className="h-10 w-10" strokeWidth={3} />
          </span>

          <h2 id="sos-title" className="font-display text-3xl font-extrabold">
            SOS sent
          </h2>

          {/* Admin response banner */}
          <div className="mt-4 w-full text-left">
            {isAck ? (
              <div className="rounded-panel border border-[#30D158]/40 bg-[#30D158]/15 p-4 shadow-sm animate-pulse">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#30D158]">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Campus Admin is Responding
                </div>
                <p className="mt-1 text-sm font-medium text-white/95">
                  {activeSos?.admin_note || 'Security has acknowledged your alert and is responding.'}
                </p>
                {activeSos?.acknowledged_by_name && (
                  <p className="mt-1 text-xs text-white/70">
                    Responded by: {activeSos.acknowledged_by_name}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-panel border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/85">
                <span className="h-2.5 w-2.5 rounded-full bg-signal animate-ping" />
                <span>Notified campus admin. Awaiting response…</span>
              </div>
            )}
          </div>

          {/* Live location status */}
          <div className="mt-3 flex w-full items-center justify-between rounded-control bg-white/10 px-4 py-2 text-xs text-white/80">
            <span className="flex items-center gap-1.5 font-bold">
              <MapPin className="h-3.5 w-3.5 text-[#30D158]" /> Live location active
            </span>
            <span>Updates every ~15s</span>
          </div>

          {/* Recipients summary */}
          <ul className="mt-4 w-full divide-y divide-white/10 rounded-panel bg-white/10 text-left text-sm max-h-40 overflow-y-auto">
            {(result?.recipients || activeSos?.recipients || []).map((r, i) => (
              <li key={r.phone + i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate">
                  <span className="block font-bold">{r.name}</span>
                  <span className="text-xs text-white/70">{r.phone}</span>
                </span>
                <span className={`text-xs font-bold ${r.error ? 'text-[#FF453A]' : 'text-[#30D158]'}`}>
                  {r.error ? 'Failed' : r.delivered ? 'Delivered' : 'Logged'}
                </span>
              </li>
            ))}
          </ul>

          {status && (
            <p className="mt-2 text-xs text-white/70">
              {status.remaining} of {status.max} alerts left this rolling hour.
            </p>
          )}

          {/* Safe Dialog prompt */}
          {showSafePrompt ? (
            <form onSubmit={handleSafeSubmit} className="mt-5 w-full rounded-panel bg-white/15 p-4 text-left">
              <p className="font-bold text-sm">Mark yourself safe?</p>
              <p className="text-xs text-white/80 mt-0.5">
                This will notify campus security and send an SMS update to all your contacts.
              </p>
              <input
                type="text"
                placeholder="Optional note: (e.g. Back in room safely)"
                value={safeNote}
                onChange={(e) => setSafeNote(e.target.value)}
                maxLength={200}
                className="mt-2.5 w-full rounded-control border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={markingSafe}
                  className="flex-1 rounded-control bg-white py-2 text-sm font-extrabold text-[#0A0A0C] hover:bg-white/90"
                >
                  {markingSafe ? 'Sending safe SMS…' : "Confirm I'm Safe"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSafePrompt(false)}
                  className="rounded-control border border-white/40 px-3 py-2 text-sm font-bold hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex w-full flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowSafePrompt(true)}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-panel bg-white text-base font-extrabold text-[#0A0A0C] shadow hover:bg-white/95 active:scale-[0.98] transition-all"
              >
                <ShieldCheck className="h-5 w-5 text-[#0A0A0C]" />
                I'm safe now
              </button>

              <div className="grid w-full grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={alarm.toggle}
                  className="flex h-11 items-center justify-center gap-2 rounded-panel border border-white/40 text-sm font-bold hover:bg-white/10"
                >
                  {alarm.on ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {alarm.on ? 'Stop alarm' : 'Sound alarm'}
                </button>

                <a
                  href="tel:112"
                  className="flex h-11 items-center justify-center gap-2 rounded-panel border border-white/40 text-sm font-bold hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" /> Call 112
                </a>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-1 h-10 w-full rounded-panel border border-white/20 text-xs font-bold text-white/80 hover:bg-white/10"
              >
                Minimize (SOS stays active in background)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ───────────────── OFFLINE & ERROR SCREEN ───────────────── */}
      {(phase === 'offline' || phase === 'error') && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="mb-4 flex h-18 w-18 items-center justify-center rounded-full bg-white/15">
            {phase === 'offline' ? <WifiOff className="h-9 w-9" /> : <AlertTriangle className="h-9 w-9" />}
          </span>

          <h2 id="sos-title" className="font-display text-3xl font-extrabold">
            {phase === 'offline' ? 'You are offline' : 'SOS not sent'}
          </h2>

          <p id="sos-desc" className="mt-2 text-sm text-white/85">
            {phase === 'offline'
              ? "Send the alert from your phone's SMS app now. We have queued it and will send it automatically to the campus admin when you reconnect."
              : error?.message || 'Failed to send alert. If you are in immediate danger, call 112.'}
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            {smsHref && (
              <a
                href={smsHref}
                className="flex h-14 items-center justify-center gap-2 rounded-panel bg-white text-lg font-extrabold text-[#4a0b14] hover:bg-white/90 shadow active:scale-[0.98] transition-all"
              >
                <MessageSquare className="h-5 w-5" /> Send by SMS app
              </a>
            )}

            <a
              href="tel:112"
              className="flex h-12 items-center justify-center gap-2 rounded-panel border border-white/40 font-bold hover:bg-white/10"
            >
              <Phone className="h-5 w-5" /> Call 112
            </a>

            <Button
              ref={cancelRef}
              variant="ghost"
              onClick={onClose}
              className="h-12 text-white hover:bg-white/10"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
