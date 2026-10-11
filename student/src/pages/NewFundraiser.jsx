import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { FilePicker } from '../components/FilePicker';
import { Button, Input, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { SEVERITY } from '../lib/format';

export default function NewFundraiser() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', beneficiary_name: '', story: '', amount_needed: '', severity: '3', upi_id: '' });
  const [qr, setQr] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErrors((er) => ({ ...er, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.title.trim().length < 8) er.title = 'Use at least 8 characters';
    if (form.beneficiary_name.trim().length < 2) er.beneficiary_name = 'Who is the money for?';
    if (form.story.trim().length < 30) er.story = 'Explain what happened in at least 30 characters';
    if (!(Number(form.amount_needed) > 0)) er.amount_needed = 'Enter the amount needed';
    if (form.upi_id && !/^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(form.upi_id.trim())) er.upi_id = 'Enter a valid UPI ID, like name@okaxis';
    if (!qr.length) er.qr = 'Add at least one payment QR code';
    if (!proofs.length) er.proofs = 'Add proof, such as a hospital bill or accident photo';
    if ([...qr, ...proofs].some((f) => f.size > 8 * 1024 * 1024)) er.form = 'Each file must be under 8 MB';
    setErrors(er);
    if (Object.keys(er).length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== '' && fd.append(k, String(v).trim()));
      qr.forEach((f) => fd.append('qr_images', f));
      proofs.forEach((f) => fd.append('proofs', f));
      const r = await api('/fundraisers', { method: 'POST', form: fd });
      toast.success('Submitted. You’ll be notified once the admin reviews it.');
      navigate(`/app/fundraisers/${r.id}`, { replace: true });
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app/fundraisers" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Fundraisers</Link>
      <h1 className="mt-3 text-[1.9rem] font-extrabold">Start a fundraiser</h1>
      <p className="mt-1 flex items-start gap-2 text-muted"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neem" /> Your proof documents are seen only by you and the admin. Other students see a “Verified by admin” badge.</p>

      <form onSubmit={submit} className="mt-6 space-y-8" noValidate>
        <fieldset className="panel space-y-4 p-5">
          <legend className="sr-only">About the fundraiser</legend>
          <Input label="Title" placeholder="Help Rohit recover after a bike accident" maxLength={120} value={form.title} onChange={set('title')} error={errors.title} />
          <Input label="Who is it for?" placeholder="Full name of the person who needs help" value={form.beneficiary_name} onChange={set('beneficiary_name')} error={errors.beneficiary_name} />
          <Textarea label="What happened" placeholder="What happened, what the money is for, and how urgent it is" maxLength={5000} value={form.story} onChange={set('story')} error={errors.story} className="min-h-[160px]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount needed (₹)" type="number" inputMode="numeric" min="1" value={form.amount_needed} onChange={set('amount_needed')} error={errors.amount_needed} />
            <div>
              <p className="label">How urgent?</p>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Urgency">
                {[1, 2, 3, 4].map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={form.severity === String(s)} onClick={() => setForm({ ...form, severity: String(s) })}
                    className={`h-11 rounded-control border text-[13px] font-bold ${form.severity === String(s) ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink/40'}`}>{SEVERITY[s].label}</button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="panel space-y-5 p-5">
          <legend className="sr-only">Payment details</legend>
          <div>
            <h2 className="text-lg font-bold">Payment</h2>
            <p className="text-sm text-muted">Add more than one QR code if a single UPI account may hit its daily limit.</p>
          </div>
          <FilePicker label="Payment QR codes" files={qr} onChange={(f) => { setQr(f); setErrors((e) => ({ ...e, qr: undefined })); }} max={5} accept="image/jpeg,image/png,image/webp" error={errors.qr} hint="Up to 5 images" />
          <Input label="UPI ID" optional placeholder="name@okaxis" value={form.upi_id} onChange={set('upi_id')} error={errors.upi_id} hint="Lets people pay straight from their UPI app" />
        </fieldset>

        <fieldset className="panel space-y-4 p-5">
          <legend className="sr-only">Proof</legend>
          <div>
            <h2 className="text-lg font-bold">Proof for the admin</h2>
            <p className="text-sm text-muted">Hospital bills, medical reports, an FIR or photos of the accident. Images or PDF.</p>
          </div>
          <FilePicker label="Proof documents" files={proofs} onChange={(f) => { setProofs(f); setErrors((e) => ({ ...e, proofs: undefined })); }} max={5} accept="image/jpeg,image/png,image/webp,application/pdf" error={errors.proofs} hint="Up to 5 files, 8 MB each" />
        </fieldset>

        {errors.form && <p className="rounded-control bg-signal/10 px-3 py-2.5 text-sm font-bold text-signal" role="alert">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Link to="/app/fundraisers" className="inline-flex h-12 items-center rounded-control px-5 font-bold hover:bg-raised">Cancel</Link>
          <Button type="submit" size="lg" loading={saving}>Submit for review</Button>
        </div>
      </form>
    </div>
  );
}
