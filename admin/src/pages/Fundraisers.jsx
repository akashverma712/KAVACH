import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, FileText, HandCoins, Mail, Phone } from 'lucide-react';
import { Drawer, PageHeader } from '../components/kit';
import { Badge, Button, EmptyState, Modal, PageLoader, Segmented, Spinner, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api, apiBlobUrl } from '../lib/api';
import { SEVERITY, dateTime, rupees, timeAgo } from '../lib/format';

const STATUS_TONE = { pending: 'brass', approved: 'neem', rejected: 'signal', closed: 'muted' };
const STATUS_LABEL = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', closed: 'Closed' };

function FundDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [proofs, setProofs] = useState({});
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api(`/admin/fundraisers/${id}`).then((d) => setF(d.fundraiser)).catch((e) => toast.error(e.message)), [id, toast]);
  useEffect(() => { load(); }, [load]);

  // Proof files are private, so fetch them with the admin token and show them as object URLs.
  useEffect(() => {
    if (!f) return undefined;
    let alive = true;
    const urls = [];
    f.proof_files.forEach((p) => apiBlobUrl(`/admin/fundraisers/${id}/proofs/${p.index}`).then((u) => {
      urls.push(u);
      if (alive) setProofs((x) => ({ ...x, [p.index]: u }));
    }).catch(() => {}));
    return () => { alive = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [f, id]);

  const review = async () => {
    if (decision === 'reject' && !note.trim()) { toast.error('Tell the student what needs to change'); return; }
    setSaving(true);
    try {
      await api(`/admin/fundraisers/${id}/review`, { method: 'POST', body: { decision, ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success(decision === 'approve' ? 'Approved. It is now visible to all students.' : 'Rejected. The student has been told why.');
      setDecision(null); setNote('');
      load(); onChanged();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  const close = async () => {
    try { await api(`/admin/fundraisers/${id}/close`, { method: 'POST' }); toast.success('Fundraiser closed'); load(); onChanged(); } catch (e) { toast.error(e.message); }
  };

  return (
    <Drawer open onClose={onClose} title={f ? f.title : 'Loading…'} wide
      footer={f && (
        <>
          {f.status !== 'closed' && <Button variant="ghost" onClick={close}>Close fundraiser</Button>}
          {f.status !== 'rejected' && f.status !== 'closed' && <Button variant="outline" className="text-signal" onClick={() => setDecision('reject')}>Reject</Button>}
          {f.status !== 'approved' && f.status !== 'closed' && <Button variant="success" onClick={() => setDecision('approve')}><BadgeCheck className="h-4 w-4" /> Approve</Button>}
        </>
      )}>
      {!f ? <div className="flex justify-center py-20"><Spinner /></div> : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
            <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label} urgency</Badge>
          </div>
          <div className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
            <div className="bg-surface p-4"><p className="text-sm text-muted">Amount needed</p><p className="font-display text-2xl font-extrabold">{rupees(f.amount_needed)}</p></div>
            <div className="bg-surface p-4"><p className="text-sm text-muted">Raised (self-reported)</p><p className="font-display text-2xl font-extrabold">{rupees(f.amount_raised)}</p></div>
            <div className="bg-surface p-4"><p className="text-sm text-muted">For</p><p className="text-lg font-bold">{f.beneficiary_name}</p></div>
          </div>
          <section className="rounded-panel bg-raised p-4">
            <p className="font-bold">{f.organiser_name} <span className="font-normal text-muted">{f.organiser_regd_no || ''}</span></p>
            <p className="text-sm text-muted">{[f.organiser_branch, f.organiser_batch].filter(Boolean).join(', ')}, submitted {dateTime(f.created_at)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {f.organiser_phone && <a href={`tel:${f.organiser_phone}`} className="inline-flex items-center gap-1.5 font-bold"><Phone className="h-3.5 w-3.5" /> {f.organiser_phone}</a>}
              {f.organiser_email && <a href={`mailto:${f.organiser_email}`} className="inline-flex items-center gap-1.5 font-bold"><Mail className="h-3.5 w-3.5" /> {f.organiser_email}</a>}
            </div>
          </section>
          <section><h3 className="font-bold">Story</h3><p className="mt-1 whitespace-pre-wrap leading-relaxed">{f.story}</p></section>
          <section>
            <h3 className="font-bold">Proof documents</h3>
            <p className="text-sm text-muted">Private. Only you and the organiser can open these.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {f.proof_files.map((p) => (
                <a key={p.index} href={proofs[p.index]} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-control border border-line bg-raised">
                  {p.mime.startsWith('image/') && proofs[p.index]
                    ? <img src={proofs[p.index]} alt={p.original} className="aspect-[4/3] w-full object-cover" />
                    : <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-muted"><FileText className="h-8 w-8" />{!proofs[p.index] && <Spinner className="h-4 w-4" />}</div>}
                  <p className="truncate px-3 py-2 text-sm font-bold">{p.original}</p>
                </a>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-bold">Payment QR codes</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              {f.qr_images.map((q) => <a key={q} href={q} target="_blank" rel="noreferrer"><img src={q} alt="Payment QR" className="h-36 w-36 rounded-control border border-line bg-white object-contain p-1" /></a>)}
            </div>
            {f.upi_id && <p className="mt-3 text-[15px]">UPI ID: <span className="font-bold">{f.upi_id}</span></p>}
          </section>
          {f.admin_note && <p className="rounded-control bg-raised p-3 text-[15px]"><span className="font-bold">Your note:</span> {f.admin_note}</p>}
        </div>
      )}
      <Modal open={Boolean(decision)} onClose={() => setDecision(null)} size="sm" title={decision === 'approve' ? 'Approve this fundraiser?' : 'Reject this fundraiser'}
        footer={<><Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision === 'approve' ? 'success' : 'danger'} loading={saving} onClick={review}>{decision === 'approve' ? 'Approve and publish' : 'Reject'}</Button></>}>
        <p className="mb-4 text-muted">{decision === 'approve' ? 'It will be visible to every student with a “Verified by admin” badge.' : 'The student will see your note and can submit a new fundraiser.'}</p>
        <Textarea label={decision === 'approve' ? 'Note to student' : 'What needs to change?'} optional={decision === 'approve'} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-[90px]" />
      </Modal>
    </Drawer>
  );
}

export default function Fundraisers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const openId = params.get('open');

  const load = useCallback(() => api(`/admin/fundraisers?status=${status}`).then(setData).catch((e) => toast.error(e.message)), [status, toast]);
  useEffect(() => { setData(null); load(); }, [load]);
  const c = data?.counts || {};

  return (
    <div>
      <PageHeader title="Fundraisers">Check the proof before anything goes live. Approved fundraisers show a “Verified by admin” badge to students.</PageHeader>
      <Segmented label="Status" className="mb-5" value={status} onChange={setStatus} options={[
        { value: 'pending', label: `Pending${c.pending ? ` (${c.pending})` : ''}` },
        { value: 'approved', label: `Approved${c.approved ? ` (${c.approved})` : ''}` },
        { value: 'rejected', label: 'Rejected' },
        { value: 'closed', label: 'Closed' },
      ]} />
      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <div className="panel"><EmptyState icon={HandCoins} title={status === 'pending' ? 'Nothing waiting for review' : 'No fundraisers here'}>New submissions appear in Pending.</EmptyState></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((f) => {
            const pct = Math.min(100, Math.round((f.amount_raised / f.amount_needed) * 100));
            return (
              <button key={f.id} type="button" onClick={() => setParams({ open: f.id })} className="panel flex flex-col p-5 text-left hover:border-ink/30">
                <div className="flex flex-wrap gap-2"><Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge><Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge></div>
                <h2 className="mt-2 line-clamp-2 text-lg font-bold">{f.title}</h2>
                <p className="text-sm text-muted">For {f.beneficiary_name}, by {f.organiser_name}, {timeAgo(f.created_at)}</p>
                <p className="mt-2 text-sm text-muted">{f.qr_images.length} QR code{f.qr_images.length > 1 ? 's' : ''}, {f.proof_count} proof file{f.proof_count > 1 ? 's' : ''}</p>
                <div className="mt-auto pt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-neem" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1.5 text-sm"><span className="font-bold">{rupees(f.amount_raised)}</span> <span className="text-muted">of {rupees(f.amount_needed)}</span></p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {openId && <FundDrawer id={openId} onClose={() => setParams({})} onChanged={() => { load(); window.dispatchEvent(new Event('kavach-refresh-counts')); }} />}
    </div>
  );
}
