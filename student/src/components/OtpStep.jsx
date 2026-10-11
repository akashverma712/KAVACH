import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Smartphone } from 'lucide-react';
import { Button } from './ui';
import { OtpInput } from './OtpInput';

export function ChannelPicker({ channels, onPick, loadingChannel }) {
  return (
    <div className="space-y-3">
      <p className="font-bold">Where should we send your code?</p>
      {channels.map((c) => {
        const Icon = c.type === 'email' ? Mail : Smartphone;
        return (
          <button key={c.type} type="button" onClick={() => onPick(c.type)} disabled={Boolean(loadingChannel)}
            className="flex w-full items-center gap-4 rounded-panel border border-line bg-surface px-4 py-4 text-left transition-colors hover:border-ink/40 disabled:opacity-60">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-raised"><Icon className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block font-bold">{c.type === 'email' ? 'Email' : 'SMS to phone'}</span>
              <span className="text-sm text-muted">{c.masked}</span>
            </span>
            {loadingChannel === c.type && <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" />}
          </button>
        );
      })}
    </div>
  );
}

export function OtpStep({ delivery, channels, onVerify, onResend, onSwitch, onBack }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(delivery?.resendIn ?? 30);

  useEffect(() => { setWait(delivery?.resendIn ?? 30); setCode(''); setError(null); }, [delivery]);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (value = code) => {
    if (value.length !== 6) { setError('Enter all 6 digits'); return; }
    setVerifying(true);
    setError(null);
    try {
      await onVerify(value);
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try { await onResend(delivery.channel); } catch (err) { setError(err.message); if (err.retryAfter) setWait(err.retryAfter); } finally { setResending(false); }
  };

  const other = channels?.find((c) => c.type !== delivery?.channel);

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5" noValidate>
      <div>
        <p className="font-bold">Enter the 6-digit code</p>
        <p className="mt-1 text-[15px] text-muted">
          Sent by {delivery?.channel === 'email' ? 'email' : 'SMS'} to <span className="font-bold text-ink">{delivery?.masked}</span>. It expires in {Math.round((delivery?.expiresIn || 300) / 60)} minutes.
        </p>
      </div>
      <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); if (v.length === 6 && !verifying) submit(v); }} disabled={verifying} invalid={Boolean(error)} />
      {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={verifying}>Verify code</Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-bold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="flex items-center gap-4">
          {other && <button type="button" onClick={() => onSwitch(other.type)} className="font-bold text-muted hover:text-ink">Use {other.type === 'email' ? 'email' : 'phone'} instead</button>}
          <button type="button" onClick={resend} disabled={wait > 0 || resending} className="font-bold text-ink disabled:text-muted">
            {wait > 0 ? `Resend in ${wait}s` : resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
      </div>
    </form>
  );
}
