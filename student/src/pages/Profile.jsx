import { useEffect, useState } from 'react';
import { BadgeCheck, Download, Lock, LogOut, Mail, Smartphone, Shield, KeyRound } from 'lucide-react';
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
      <div className="flex h-11 items-center gap-2.5 rounded-control border border-dashed border-line bg-raised/70 px-3.5 text-sm text-ink">
        <Icon className="h-4 w-4 text-muted shrink-0" aria-hidden />
        <span className={`flex-1 truncate font-medium ${value ? '' : 'text-muted'}`}>
          {value || 'Not configured'}
        </span>
        <span className="flex items-center gap-1 rounded-tag bg-raised px-1.5 py-0.5 text-[10px] font-bold text-muted">
          <Lock className="h-3 w-3" /> Locked
        </span>
      </div>
    </div>
  );
}

function PasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ current: '', next: '' });
      setError(null);
    }
  }, [open]);

  const save = async (e) => {
    e.preventDefault();
    if (form.next.length < 8 || !/[A-Za-z]/.test(form.next) || !/\d/.test(form.next)) {
      setError('New password must contain at least 8 characters with a letter and a number');
      return;
    }
    setSaving(true);
    try {
      const r = await api('/me/password', {
        method: 'POST',
        body: { current_password: form.current, new_password: form.next },
      });
      tokenStore.set(r.token);
      toast.success('Password updated successfully. Other device sessions were signed out.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update Account Password"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pw-form" loading={saving}>
            Update Password
          </Button>
        </>
      }
    >
      <form id="pw-form" onSubmit={save} className="space-y-4" noValidate>
        <PasswordInput
          label="Current Password"
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New Password"
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          autoComplete="new-password"
          hint="At least 8 characters with letters & numbers"
        />
        {error && (
          <p className="text-xs font-bold text-signal" role="alert">
            {error}
          </p>
        )}
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
    if (user) {
      setForm({
        name: user.name || '',
        branch: user.branch || '',
        batch: user.batch || '',
        regd_no: user.regd_no || '',
      });
    }
  }, [user]);

  const dirty =
    user &&
    (form.name !== (user.name || '') ||
      form.branch !== (user.branch || '') ||
      form.batch !== (user.batch || '') ||
      form.regd_no !== (user.regd_no || ''));

  const save = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setErrors({ name: 'Enter your full name' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const r = await api('/me', {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          branch: form.branch.trim(),
          batch: form.batch.trim(),
          regd_no: form.regd_no.trim(),
        },
      });
      setUser(r.user);
      toast.success('Profile details saved');
    } catch (err) {
      const f = err.details?.[0]?.field;
      setErrors(f ? { [f]: err.message } : { form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Student Identity Header */}
      <section className="flex items-center gap-4 p-2">
        <Avatar name={user?.name} size={64} className="border-2 border-glacial/40" />
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-black text-ink">
            {user?.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {user?.college_verified ? (
              <Badge tone="neem">
                <BadgeCheck className="h-3 w-3" /> Verified Student Records
              </Badge>
            ) : (
              <Badge tone="brass">Pending College Verification</Badge>
            )}
            <span className="text-xs font-bold text-muted">
              {[user?.branch, user?.batch].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </section>

      {/* Details Card */}
      <section className="panel p-5 sm:p-6" aria-labelledby="details-title">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
              COLLEGE RECORD
            </span>
            <h2 id="details-title" className="font-display text-lg font-black text-ink">
              Student Details
            </h2>
          </div>
        </div>

        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2">
            <Input
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
              autoComplete="name"
            />
          </div>
          <Input
            label="Engineering Branch"
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            error={errors.branch}
            placeholder="e.g. Mechanical Engineering"
          />
          <Input
            label="Academic Batch"
            value={form.batch}
            onChange={(e) => setForm({ ...form, batch: e.target.value })}
            error={errors.batch}
            placeholder="e.g. 2022-2026"
          />
          <div className="sm:col-span-2">
            <Input
              label="Registration Number"
              value={form.regd_no}
              onChange={(e) => setForm({ ...form, regd_no: e.target.value })}
              error={errors.regd_no}
            />
          </div>
          <LockedField label="Registered Email" value={user?.email} icon={Mail} />
          <LockedField label="Registered Mobile" value={user?.phone} icon={Smartphone} />

          <p className="text-xs text-muted sm:col-span-2">
            Email & Phone numbers are matched against BIT Sindri registration records and can only be altered by campus administrators.
          </p>

          {errors.form && (
            <p className="text-xs font-bold text-signal sm:col-span-2" role="alert">
              {errors.form}
            </p>
          )}

          <div className="sm:col-span-2 pt-2">
            <Button type="submit" loading={saving} disabled={!dirty} variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </section>

      {/* Emergency Contacts Card */}
      <section className="panel p-5 sm:p-6" aria-labelledby="ec-title">
        <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
          DISPATCH LIST
        </span>
        <h2 id="ec-title" className="font-display text-lg font-black text-ink">
          Emergency Contacts
        </h2>
        <p className="text-xs text-muted mt-0.5">
          These contacts receive emergency SMS notifications and real-time GPS map links during an SOS dispatch.
        </p>
        <div className="mt-4">
          <ContactsManager />
        </div>
      </section>

      {/* System Preferences */}
      <section className="panel p-5 sm:p-6" aria-labelledby="pref-title">
        <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
          SETTINGS
        </span>
        <h2 id="pref-title" className="font-display text-lg font-black text-ink">
          Preferences & Application Mode
        </h2>

        <div className="mt-4 space-y-5">
          <div>
            <p className="label">Color Theme</p>
            <ThemeSelector />
          </div>

          {voice?.supported && (
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-line bg-raised/50 p-3">
              <div>
                <span className="block text-sm font-bold text-ink">Voice Guard Keyword Trigger</span>
                <span className="text-xs text-muted">
                  Say “help” or “bachao” while Kavach is open on your screen.
                </span>
              </div>
              <input
                type="checkbox"
                checked={voiceOn}
                onChange={(e) => setVoiceOn(e.target.checked)}
                className="h-5 w-5 rounded accent-signal"
              />
            </label>
          )}

          {!standalone && (
            <div className="flex items-center justify-between gap-4 rounded-control border border-line bg-raised/50 p-3">
              <div>
                <span className="block text-sm font-bold text-ink">Install PWA Application</span>
                <span className="text-xs text-muted">
                  {canInstall
                    ? 'Install to home screen for offline access and emergency quick-launch.'
                    : 'Use browser menu → “Add to Home Screen”.'}
                </span>
              </div>
              {canInstall && (
                <Button variant="outline" size="sm" onClick={install}>
                  <Download className="h-3.5 w-3.5" /> Install
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Account Security & Sign Out Actions */}
      <section className="flex flex-wrap gap-2.5 pt-2">
        <Button variant="outline" onClick={() => setPwOpen(true)}>
          <KeyRound className="h-4 w-4" /> Change Password
        </Button>
        <Button variant="ghost" className="text-signal hover:bg-signal/10" onClick={() => logout()}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </section>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
