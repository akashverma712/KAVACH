import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { PageHeader } from '../components/kit';
import { ThemeSelector } from '../components/ThemeToggle';
import { Button, Input, PageLoader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';

function DeliveryRow({ label, live, liveText, offText }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {live ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neem" /> : <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-brass" />}
      <div><p className="font-bold">{label}</p><p className="text-sm text-muted">{live ? liveText : offText}</p></div>
    </li>
  );
}

export default function Settings() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [form, setForm] = useState({ admin_emergency_name: '', admin_emergency_phone: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState(null);

  useEffect(() => {
    api('/admin/settings').then((d) => { setS(d); setForm({ admin_emergency_name: d.emergency.name, admin_emergency_phone: d.emergency.phone || '' }); }).catch((e) => toast.error(e.message));
    api('/admin/audit?limit=40').then((d) => setAudit(d.items)).catch(() => setAudit([]));
  }, [toast]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const d = await api('/admin/settings', { method: 'PUT', body: { admin_emergency_name: form.admin_emergency_name.trim(), admin_emergency_phone: form.admin_emergency_phone.trim() } });
      setS((x) => ({ ...x, emergency: d.emergency }));
      toast.success('Campus emergency contact saved');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  if (!s) return <PageLoader />;
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" />
      <section className="panel p-5 sm:p-6">
        <h2 className="text-lg font-bold">Campus emergency contact</h2>
        <p className="text-sm text-muted">Included in every student’s emergency contacts. Every SOS alert is sent to this number.</p>
        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <Input label="Name shown to students" value={form.admin_emergency_name} onChange={(e) => setForm({ ...form, admin_emergency_name: e.target.value })} />
          <Input label="Phone number" type="tel" value={form.admin_emergency_phone} onChange={(e) => setForm({ ...form, admin_emergency_phone: e.target.value })} error={error} />
          <div className="sm:col-span-2"><Button type="submit" loading={saving}>Save contact</Button></div>
        </form>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="text-lg font-bold">Message delivery</h2>
        <p className="text-sm text-muted">Set in <code className="rounded bg-raised px-1">backend/.env</code>. The server picks up changes automatically in development.</p>
        <ul className="mt-2 divide-y divide-line">
          <DeliveryRow label="Email (OTP codes, SOS copies)" live={s.delivery.email === 'smtp'} liveText="Sending through your SMTP server." offText="Not configured. Emails are printed in the backend terminal. Fill SMTP_HOST, SMTP_USER and SMTP_PASS." />
          <DeliveryRow label="SMS (OTP codes, SOS alerts)" live={s.delivery.sms === 'twilio'} liveText="Sending through Twilio." offText="Not configured. SMS are printed in the backend terminal. Fill TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER." />
          <DeliveryRow label="Chatbot AI answers" live={s.delivery.chatbot === 'ai'} liveText="Using AI with your knowledge base as context." offText="Answering from the knowledge base only. Add ANTHROPIC_API_KEY for AI answers (optional)." />
        </ul>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="text-lg font-bold">Your account</h2>
        <dl className="mt-3 grid gap-3 text-[15px] sm:grid-cols-3">
          <div><dt className="text-sm text-muted">Name</dt><dd className="font-bold">{s.admin.name}</dd></div>
          <div><dt className="text-sm text-muted">Email</dt><dd className="font-bold">{s.admin.email}</dd></div>
          <div><dt className="text-sm text-muted">Phone</dt><dd className="font-bold">{s.admin.phone || '–'}</dd></div>
        </dl>
        <div className="mt-6 max-w-sm"><p className="label">Appearance</p><ThemeSelector /></div>
      </section>

      <section className="panel overflow-hidden">
        <div className="px-5 pt-5 sm:px-6"><h2 className="text-lg font-bold">Activity log</h2><p className="text-sm text-muted">Recent sign-ins and actions, newest first.</p></div>
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {(audit || []).map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted sm:px-6">{dateTime(a.created_at)}</td>
                  <td className="px-3 py-2.5"><span className="font-bold">{a.actor_name || a.actor_type}</span> <span className="text-muted">({a.actor_type})</span></td>
                  <td className="px-3 py-2.5 font-bold">{a.action}</td>
                  <td className="hidden px-3 py-2.5 text-muted md:table-cell">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
