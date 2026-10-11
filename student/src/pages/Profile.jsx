import { useEffect, useState } from 'react';
import { BadgeCheck, Download, Lock, LogOut, Mail, Smartphone } from 'lucide-react';
import { ContactsManager } from '../components/ContactsManager';
import { PasswordInput } from '../components/PasswordInput';
import { ThemeSelector } from '../components/ThemeToggle';
import { Avatar, Badge, Button, Input, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSos } from '../context/SosContext';
import { useToast } from '../context/ToastContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { api, tokenStore } from '../lib/api';

function LockedField({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex h-[46px] items-center gap-2.5 rounded-control border border-dashed border-line bg-raised px-3.5 text-[15px]">
        <Icon className="h-[18px] w-[18px] text-muted" aria-hidden />
        <span className={`flex-1 truncate ${value ? '' : 'text-muted'}`}>{value || 'Not added'}</span>
        <Lock className="h-4 w-4 text-muted" aria-label="Locked" />
      </div>
    </div>
  );
}

function PasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm({ current: '', next: '' }); setError(null); } }, [open]);
  const save = async (e) => {
    e.preventDefault();
    if (form.next.length < 8 || !/[A-Za-z]/.test(form.next) || !/\d/.test(form.next)) { setError('New password needs 8+ characters with a letter and a number'); return; }
    setSaving(true);
    try {
      const r = await api('/me/password', { method: 'POST', body: { current_password: form.current, new_password: form.next } });
      tokenStore.set(r.token);
      toast.success('Password changed. Other devices have been signed out.');
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="pw-form" loading={saving}>Change password</Button></>}>
      <form id="pw-form" onSubmit={save} className="space-y-4" noValidate>
        <PasswordInput label="Current password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" />
        <PasswordInput label="New password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" hint="At least 8 characters with a letter and a number" />
        {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { voiceOn, setVoiceOn, voice } = useSos();
  const toast = useToast();
  const { canInstall, install, standalone } = usePwaInstall();
  const [form, setForm] = useState({ name: '', branch: '', batch: '', regd_no: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', branch: user.branch || '', batch: user.batch || '', regd_no: user.regd_no || '' });
  }, [user]);

  const dirty = user && (form.name !== (user.name || '') || form.branch !== (user.branch || '') || form.batch !== (user.batch || '') || form.regd_no !== (user.regd_no || ''));

  const save = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) { setErrors({ name: 'Enter your full name' }); return; }
    setSaving(true);
    setErrors({});
    try {
      const r = await api('/me', { method: 'PATCH', body: { name: form.name.trim(), branch: form.branch.trim(), batch: form.batch.trim(), regd_no: form.regd_no.trim() } });
      setUser(r.user);
      toast.success('Profile saved');
    } catch (err) {
      const f = err.details?.[0]?.field;
      setErrors(f ? { [f]: err.message } : { form: err.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex items-center gap-4">
        <Avatar name={user?.name} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold">{user?.name}</h1>
          {user?.college_verified
            ? <Badge tone="neem"><BadgeCheck className="h-3.5 w-3.5" /> Matched with college records</Badge>
            : <Badge tone="brass">Not yet matched with college records</Badge>}
        </div>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="details-title">
        <h2 id="details-title" className="text-lg font-bold">Your details</h2>
        <p className="text-sm text-muted">Filled in from college records. You can correct them here.</p>
        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2"><Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="name" /></div>
          <Input label="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} error={errors.branch} placeholder="Computer Science & Engineering" />
          <Input label="Batch" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} error={errors.batch} placeholder="2022-2026" />
          <div className="sm:col-span-2"><Input label="Registration number" value={form.regd_no} onChange={(e) => setForm({ ...form, regd_no: e.target.value })} error={errors.regd_no} /></div>
          <LockedField label="Email" value={user?.email} icon={Mail} />
          <LockedField label="Phone" value={user?.phone} icon={Smartphone} />
          <p className="text-sm text-muted sm:col-span-2">Email and phone are verified against college records, so they can’t be changed here. Contact the admin if they’re wrong.</p>
          {errors.form && <p className="text-sm font-bold text-signal sm:col-span-2">{errors.form}</p>}
          <div className="sm:col-span-2"><Button type="submit" loading={saving} disabled={!dirty}>Save changes</Button></div>
        </form>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="ec-title">
        <h2 id="ec-title" className="text-lg font-bold">Emergency contacts</h2>
        <p className="text-sm text-muted">They get an SMS with your live location whenever you send an SOS. The campus admin is always included.</p>
        <div className="mt-2"><ContactsManager /></div>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="pref-title">
        <h2 id="pref-title" className="text-lg font-bold">Preferences</h2>
        <div className="mt-4 space-y-5">
          <div>
            <p className="label">Appearance</p>
            <ThemeSelector />
          </div>
          {voice.supported && (
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span><span className="block font-bold">Voice SOS</span><span className="text-sm text-muted">Say “help” while the app is open to start an SOS.</span></span>
              <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--signal))]" />
            </label>
          )}
          {!standalone && (
            <div className="flex items-center justify-between gap-4">
              <span><span className="block font-bold">Install Kavach</span><span className="text-sm text-muted">{canInstall ? 'Add it to your home screen. It opens even without internet.' : 'Use your browser’s “Add to Home screen” option to install.'}</span></span>
              {canInstall && <Button variant="outline" size="sm" onClick={install}><Download className="h-4 w-4" /> Install</Button>}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPwOpen(true)}><Lock className="h-4 w-4" /> Change password</Button>
        <Button variant="ghost" className="text-signal" onClick={() => logout()}><LogOut className="h-4 w-4" /> Sign out</Button>
      </section>
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
