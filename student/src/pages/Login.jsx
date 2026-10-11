import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AtSign } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { ChannelPicker, OtpStep } from '../components/OtpStep';
import { OtpInput } from '../components/OtpInput';
import { PasswordInput } from '../components/PasswordInput';
import { Button, Input } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState('credentials');
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [sendingChannel, setSendingChannel] = useState(null);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors({}); };

  const start = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.identifier.trim().length < 2) er.identifier = 'Enter your name, email or phone number';
    if (!form.password) er.password = 'Enter your password';
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const r = await api('/auth/login/start', { method: 'POST', auth: false, body: { identifier: form.identifier.trim(), password: form.password } });
      setSession(r);
      setStep(r.delivery ? 'otp' : 'channel');
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  const sendTo = async (channel) => {
    setSendingChannel(channel);
    try {
      const r = await api('/auth/otp/send', { method: 'POST', auth: false, body: { otp_id: session.otp_id, channel } });
      setSession((s) => ({ ...s, delivery: r.delivery }));
      setStep('otp');
    } catch (err) {
      toast.error(err.message);
      if (err.code === 'OTP_SESSION_EXPIRED') setStep('credentials');
      throw err;
    } finally {
      setSendingChannel(null);
    }
  };

  const verify = async (code) => {
    const r = await api('/auth/login/verify', { method: 'POST', auth: false, body: { otp_id: session.otp_id, code } });
    signIn(r.token, r.user);
    navigate(location.state?.from?.startsWith('/app') ? location.state.from : '/app', { replace: true });
  };

  return (
    <AuthLayout
      title={step === 'credentials' ? 'Sign in' : step === 'forgot' ? 'Reset your password' : 'Verify it’s you'}
      subtitle={step === 'credentials' ? 'Use your name, college email or phone number with your password.' : null}
      footer={<>New to Kavach? <Link to="/register" className="font-bold text-ink underline-offset-2 hover:underline">Create an account</Link></>}
    >
      {step === 'credentials' && (
        <form onSubmit={start} className="space-y-4" noValidate>
          <Input label="Name, email or phone" icon={AtSign} value={form.identifier} onChange={set('identifier')} error={errors.identifier} autoComplete="username" autoFocus />
          <PasswordInput label="Password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
          {errors.form && <p className="rounded-control bg-signal/10 px-3 py-2.5 text-sm font-bold text-signal" role="alert">{errors.form}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Continue</Button>
          <button type="button" onClick={() => setStep('forgot')} className="mx-auto block text-sm font-bold text-muted hover:text-ink">Forgot your password?</button>
        </form>
      )}
      {step === 'forgot' && <ForgotPassword onDone={(token, user) => { signIn(token, user); navigate('/app', { replace: true }); }} onBack={() => setStep('credentials')} />}
      {step === 'channel' && session && (
        <div className="space-y-4">
          <ChannelPicker channels={session.channels} onPick={(c) => sendTo(c).catch(() => {})} loadingChannel={sendingChannel} />
          <button type="button" onClick={() => setStep('credentials')} className="font-bold text-muted hover:text-ink">Back</button>
        </div>
      )}
      {step === 'otp' && session && (
        <OtpStep delivery={session.delivery} channels={session.channels} onVerify={verify}
          onResend={(c) => sendTo(c)} onSwitch={(c) => sendTo(c).catch(() => {})}
          onBack={() => setStep(session.channels.length > 1 ? 'channel' : 'credentials')} />
      )}
    </AuthLayout>
  );
}

function ForgotPassword({ onDone, onBack }) {
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [session, setSession] = useState(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const request = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api('/auth/password/forgot', { method: 'POST', auth: false, body: { identifier: identifier.trim() } });
      setSession(r);
      setWait(r.delivery?.resendIn || 30);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const resend = async () => {
    try {
      await api('/auth/password/resend', { method: 'POST', auth: false, body: { otp_id: session.otp_id } });
      setWait(30);
      toast.info('A new code is on its way');
    } catch (err) { setError(err.message); if (err.retryAfter) setWait(err.retryAfter); }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setError('New password needs 8+ characters with a letter and a number'); return; }
    setError(null);
    setLoading(true);
    try {
      const r = await api('/auth/password/reset', { method: 'POST', auth: false, body: { otp_id: session.otp_id, code, new_password: pw } });
      if (r.token) { toast.success('Password updated. You are signed in.'); onDone(r.token, r.user); }
      else { toast.info(r.message); onBack(); }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (!session) {
    return (
      <form onSubmit={request} className="space-y-4" noValidate>
        <p className="text-muted">Enter the email or phone number on your account. We will send a code to it.</p>
        <Input label="Email or phone" icon={AtSign} value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(null); }} autoFocus autoComplete="username" />
        {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset code</Button>
        <button type="button" onClick={onBack} className="mx-auto block text-sm font-bold text-muted hover:text-ink">Back to sign in</button>
      </form>
    );
  }
  return (
    <form onSubmit={reset} className="space-y-5" noValidate>
      <p className="text-muted">If an account exists for <span className="font-bold text-ink">{session.delivery.masked}</span>, a code has been sent to it.</p>
      <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} invalid={Boolean(error)} />
      <PasswordInput label="New password" value={pw} onChange={(e) => { setPw(e.target.value); setError(null); }} autoComplete="new-password" hint="At least 8 characters with a letter and a number" />
      {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
      <div className="flex justify-between text-[15px]">
        <button type="button" onClick={() => setSession(null)} className="font-bold text-muted hover:text-ink">Use a different email or phone</button>
        <button type="button" onClick={resend} disabled={wait > 0} className="font-bold text-ink disabled:text-muted">{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button>
      </div>
    </form>
  );
}
