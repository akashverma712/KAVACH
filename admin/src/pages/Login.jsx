import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { OtpInput } from '../components/OtpInput';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [session, setSession] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const start = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address'); return; }
    setLoading(true); setError(null);
    try {
      const r = await api('/admin/auth/start', { method: 'POST', auth: false, body: { email: email.trim() } });
      setSession(r); setCode(''); setWait(r.delivery.resendIn || 30);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const verify = async (value = code) => {
    if (value.length !== 6) { setError('Enter all 6 digits'); return; }
    setLoading(true); setError(null);
    try {
      const r = await api('/admin/auth/verify', { method: 'POST', auth: false, body: { otp_id: session.otp_id, code: value } });
      signIn(r.token, r.admin);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) { setError(err.message); setCode(''); } finally { setLoading(false); }
  };

  const resend = async () => {
    setError(null);
    try {
      await api('/admin/auth/resend', { method: 'POST', auth: false, body: { otp_id: session.otp_id } });
      setWait(30);
    } catch (err) {
      if (err.status === 410 || err.code === 'VALIDATION_ERROR') setError('If this email belongs to an admin, a code was sent. Go back and try again.');
      else setError(err.message);
      if (err.retryAfter) setWait(err.retryAfter);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-5"><Logo /><ThemeToggle /></header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="panel w-full max-w-md p-7 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-bg"><ShieldCheck className="h-6 w-6" /></span>
          <h1 className="mt-5 text-2xl font-extrabold">{session ? 'Check your email' : 'Admin sign in'}</h1>
          {!session ? (
            <form onSubmit={start} className="mt-6 space-y-4" noValidate>
              <p className="text-muted">We’ll email a one-time code to the admin address.</p>
              <Input label="Admin email" icon={Mail} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} autoComplete="email" autoFocus />
              {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={loading}>Send code</Button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="mt-6 space-y-5" noValidate>
              <p className="text-muted">If <span className="font-bold text-ink">{session.delivery.masked}</span> is an admin account, a 6-digit code is on its way. It expires in {Math.round(session.delivery.expiresIn / 60)} minutes.</p>
              <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); if (v.length === 6 && !loading) verify(v); }} invalid={Boolean(error)} disabled={loading} />
              {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
              <div className="flex justify-between text-[15px]">
                <button type="button" onClick={() => { setSession(null); setError(null); }} className="inline-flex items-center gap-1 font-bold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Change email</button>
                <button type="button" onClick={resend} disabled={wait > 0} className="font-bold text-ink disabled:text-muted">{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
