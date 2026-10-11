import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Clock, Copy, FileText, Smartphone, XCircle } from 'lucide-react';
import { ImageLightbox } from '../components/ImageLightbox';
import { Badge, Button, EmptyState, Input, Modal, PageLoader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { API_BASE, api, tokenStore } from '../lib/api';
import { SEVERITY, dateTime, rupees } from '../lib/format';

export default function FundraiserDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [raised, setRaised] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(() => api(`/fundraisers/${id}`).then((d) => { setF(d.fundraiser); setRaised(String(d.fundraiser.amount_raised)); }).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  const copyUpi = async () => {
    try { await navigator.clipboard.writeText(f.upi_id); toast.success('UPI ID copied'); } catch { toast.info(f.upi_id); }
  };

  const saveRaised = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api(`/fundraisers/${id}/raised`, { method: 'PATCH', body: { amount_raised: Number(raised) || 0 } });
      setF((x) => ({ ...x, amount_raised: r.amount_raised }));
      toast.success('Amount raised updated');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const close = async () => {
    try {
      await api(`/fundraisers/${id}/close`, { method: 'POST' });
      toast.success('Fundraiser closed');
      setClosing(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const openProof = async (i) => {
    try {
      const res = await fetch(`${API_BASE}/api/fundraisers/${id}/proofs/${i}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
      if (!res.ok) throw new Error('Could not open the file');
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { toast.error(err.message); }
  };

  if (error) return <EmptyState icon={XCircle} title="Fundraiser not found" action={<Link to="/app/fundraisers" className="font-bold underline">Back to Fundraisers</Link>}>It may have been closed or is still waiting for review.</EmptyState>;
  if (!f) return <PageLoader />;

  const pct = Math.min(100, Math.round((f.amount_raised / f.amount_needed) * 100));
  const upiLink = f.upi_id ? `upi://pay?pa=${encodeURIComponent(f.upi_id)}&pn=${encodeURIComponent(f.beneficiary_name)}&cu=INR&tn=${encodeURIComponent(f.title.slice(0, 40))}` : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/app/fundraisers" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Fundraisers</Link>

      {f.is_owner && f.status !== 'approved' && (
        <div className={`mt-4 flex items-start gap-3 rounded-panel border p-4 ${f.status === 'rejected' ? 'border-signal/40 bg-signal/10' : f.status === 'pending' ? 'border-brass/40 bg-brass/10' : 'border-line bg-raised'}`}>
          {f.status === 'pending' ? <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brass" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-signal" />}
          <div>
            <p className="font-bold">{{ pending: 'Waiting for admin review', rejected: 'The admin asked for changes', closed: 'This fundraiser is closed' }[f.status]}</p>
            <p className="text-[15px] text-muted">
              {f.status === 'pending' && 'Only you can see this page until it’s approved. You’ll get a notification.'}
              {f.status === 'rejected' && (f.admin_note || 'Contact the admin for details.')}
              {f.status === 'closed' && 'It no longer appears in the active list.'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="panel p-5 sm:p-7">
          <div className="flex flex-wrap gap-2">
            {f.status === 'approved' && <Badge tone="neem"><BadgeCheck className="h-3.5 w-3.5" /> Verified by admin</Badge>}
            <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label} urgency</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-[1.75rem]">{f.title}</h1>
          <p className="mt-1 text-muted">For <span className="font-bold text-ink">{f.beneficiary_name}</span>, started by {f.is_owner ? 'you' : f.organiser_name}{f.organiser_branch ? ` (${f.organiser_branch})` : ''} on {dateTime(f.created_at)}</p>
          <p className="mt-5 whitespace-pre-wrap leading-relaxed">{f.story}</p>
          {f.is_owner && f.proof_count > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="font-bold">Your proof documents</p>
              <p className="text-sm text-muted">Visible only to you and the admin.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: f.proof_count }, (_, i) => (
                  <Button key={i} variant="outline" size="sm" onClick={() => openProof(i)}><FileText className="h-4 w-4" /> Proof {i + 1}</Button>
                ))}
              </div>
            </div>
          )}
        </article>

        <aside className="space-y-4">
          <section className="panel p-5">
            <p className="font-display text-3xl font-extrabold">{rupees(f.amount_raised)}</p>
            <p className="text-muted">raised of {rupees(f.amount_needed)}</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-neem" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1.5 text-sm text-muted">{pct}% of the goal, updated by the organiser</p>
          </section>

          <section className="panel p-5" aria-labelledby="pay-title">
            <h2 id="pay-title" className="font-bold">Pay directly</h2>
            <p className="text-sm text-muted">Scan any QR with a UPI app. If one fails, try the next.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {f.qr_images.map((src, i) => (
                <button key={src} type="button" onClick={() => setLightbox(i)} className="aspect-square overflow-hidden rounded-control border border-line bg-white p-1.5" aria-label={`Enlarge QR code ${i + 1}`}>
                  <img src={src} alt={`Payment QR code ${i + 1}`} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
            {f.upi_id && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-control bg-raised px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-bold">{f.upi_id}</span>
                  <button type="button" onClick={copyUpi} className="text-muted hover:text-ink" aria-label="Copy UPI ID"><Copy className="h-4 w-4" /></button>
                </div>
                <a href={upiLink} className="flex h-11 items-center justify-center gap-2 rounded-control bg-ink font-bold text-bg sm:hidden"><Smartphone className="h-4 w-4" /> Pay with a UPI app</a>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Kavach doesn’t handle money. Payments go straight to the account behind the QR code.</p>
          </section>

          {f.is_owner && f.status === 'approved' && (
            <section className="panel p-5">
              <form onSubmit={saveRaised} className="space-y-3">
                <Input label="Update amount raised (₹)" type="number" min="0" inputMode="numeric" value={raised} onChange={(e) => setRaised(e.target.value)} />
                <Button type="submit" variant="outline" className="w-full" loading={saving}>Save amount</Button>
              </form>
              <button type="button" onClick={() => setClosing(true)} className="mt-3 w-full text-sm font-bold text-muted hover:text-signal">Close fundraiser</button>
            </section>
          )}
          {f.is_owner && f.status === 'pending' && (
            <button type="button" onClick={() => setClosing(true)} className="w-full text-sm font-bold text-muted hover:text-signal">Withdraw fundraiser</button>
          )}
        </aside>
      </div>

      <ImageLightbox images={f.qr_images} index={lightbox} onClose={() => setLightbox(null)} downloadable />
      <Modal open={closing} onClose={() => setClosing(false)} title="Close this fundraiser?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setClosing(false)}>Keep it open</Button><Button variant="danger" onClick={close}>Close fundraiser</Button></>}>
        <p className="text-muted">It will be removed from the active list. This can’t be undone.</p>
      </Modal>
    </div>
  );
}
