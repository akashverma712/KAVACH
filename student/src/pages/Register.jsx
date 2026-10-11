import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, Smartphone, UserRound, XCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { ChannelPicker, OtpStep } from '../components/OtpStep';
import { PasswordInput, passwordStrength } from '../components/PasswordInput';
import { Button, Input } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DOMAIN = 'bitsindri.ac.in';

function Eligibility({ state }) {
  if (!state) return null;
  const Icon = state.ok ? CheckCircle2 : XCircle;
  return <p className={`mt-1.5 flex items-center gap-1.5 text-[13px] font-bold ${state.ok ? 'text-neem' : 'text-signal'}`}><Icon className="h-4 w-4" /> {state.message}</p>;
}

export default function Register() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState('details'); // details | channel | otp
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [elig, setElig] = useState({});
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null); // { otp_id, channels, delivery }
  const [sendingChannel, setSendingChannel] = useState(null);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined, form: undefined })); };

  const check = async (field) => {
    const v = form[field].trim();
    if (!v) { setElig((s) => ({ ...s, [field]: null })); return; }
    try {
      const r = await api('/auth/check-eligibility', { method: 'POST', body: { [field]: v }, auth: false });
      setElig((s) => ({ ...s, [field]: r[field] }));
    } catch { /* ignore — final check happens on submit */ }
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name';
    if (!form.email.trim() && !form.phone.trim()) e.email = 'Enter your college email or registered phone number (or both)';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''))) e.phone = 'Enter a valid 10-digit mobile number';
    if (form.password.length < 8) e.password = 'Use at least 8 characters';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = 'Include at least one letter and one number';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const start = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const r = await api('/auth/register/start', {
        method: 'POST', auth: false,
        body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password },
      });
      setSession(r);
      setStep(r.delivery ? 'otp' : 'channel');
    } catch (err) {
      const map = { EMAIL_NOT_ALLOWED: 'email', INVALID_EMAIL: 'email', PHONE_NOT_ALLOWED: 'phone', INVALID_PHONE: 'phone' };
      const field = map[err.code] || (err.details?.[0]?.field) || 'form';
      setErrors({ [field]: err.message });
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
      if (err.code === 'OTP_SESSION_EXPIRED') setStep('details');
      throw err;
    } finally {
      setSendingChannel(null);
    }
  };

  const verify = async (code) => {
    const r = await api('/auth/register/verify', { method: 'POST', auth: false, body: { otp_id: session.otp_id, code } });
    signIn(r.token, r.user);
    toast.success(`Welcome to Kavach, ${r.user.name.split(' ')[0]}! Add an emergency contact to finish setting up.`);
    navigate('/app/profile', { replace: true });
  };

  const strength = form.password ? passwordStrength(form.password) : null;

  return (
    <AuthLayout
      title={step === 'details' ? 'Create your account' : 'Verify it’s you'}
      subtitle={step === 'details' ? 'Use your college email, the phone number in college records, or both.' : null}
      footer={<>Already registered? <Link to="/login" className="font-bold text-ink underline-offset-2 hover:underline">Sign in</Link></>}
    >
      {step === 'details' && (
        <form onSubmit={start} className="space-y-4" noValidate>
          <Input label="Full name" icon={UserRound} value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" autoFocus />
          <div>
            <Input label="College email" icon={Mail} type="email" inputMode="email" placeholder={`yourname@${DOMAIN}`} value={form.email}
              onChange={(e) => { set('email')(e); setElig((s) => ({ ...s, email: null })); }} onBlur={() => check('email')} error={errors.email} autoComplete="email" />
            {!errors.email && <Eligibility state={elig.email} />}
          </div>
          <div>
            <Input label="Phone number" icon={Smartphone} type="tel" inputMode="tel" placeholder="10-digit mobile number" value={form.phone}
              onChange={(e) => { set('phone')(e); setElig((s) => ({ ...s, phone: null })); }} onBlur={() => check('phone')} error={errors.phone} autoComplete="tel-national"
              hint={!elig.phone ? 'Must match the number in your college records' : undefined} />
            {!errors.phone && <Eligibility state={elig.phone} />}
          </div>
          <div>
            <PasswordInput label="Create a password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" hint="At least 8 characters with a letter and a number" />
            {strength && !errors.password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div className={`h-full ${strength.tone} transition-all`} style={{ width: `${Math.max(10, (['Too short', 'Weak', 'Okay', 'Strong', 'Very strong'].indexOf(strength.label) + 1) * 20)}%` }} />
                </div>
                <span className="text-xs font-bold text-muted">{strength.label}</span>
              </div>
            )}
          </div>
          <PasswordInput label="Confirm password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
          {errors.form && <p className="rounded-control bg-signal/10 px-3 py-2.5 text-sm font-bold text-signal" role="alert">{errors.form}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Continue</Button>
        </form>
      )}

      {step === 'channel' && session && (
        <div className="space-y-4">
          <ChannelPicker channels={session.channels} onPick={(c) => sendTo(c).catch(() => {})} loadingChannel={sendingChannel} />
          <button type="button" onClick={() => setStep('details')} className="font-bold text-muted hover:text-ink">Back to details</button>
        </div>
      )}

      {step === 'otp' && session && (
        <OtpStep
          delivery={session.delivery}
          channels={session.channels}
          onVerify={verify}
          onResend={(c) => sendTo(c)}
          onSwitch={(c) => sendTo(c).catch(() => {})}
          onBack={() => setStep(session.channels.length > 1 ? 'channel' : 'details')}
        />
      )}
    </AuthLayout>
  );
}
