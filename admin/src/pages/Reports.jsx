import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Flag, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/kit';
import { Badge, Button, EmptyState, Input, Modal, PageLoader, Segmented, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { REPORT_REASONS, timeAgo } from '../lib/format';

const ACTIONS = {
  dismiss: { label: 'Dismiss reports', desc: 'The post stays (or becomes) visible.' },
  hide_post: { label: 'Hide the post', desc: 'Students can no longer see it. The author is notified.' },
  suspend_author: { label: 'Hide and suspend author', desc: 'Hides the post and blocks the author for a number of days.' },
  ban_author: { label: 'Hide and ban author', desc: 'Hides the post and bans the author until you reinstate them.' },
};

export default function Reports() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [acting, setActing] = useState(null); // { item, action }
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api(`/admin/reports?status=${status}`).then((d) => setItems(d.items)).catch((e) => toast.error(e.message)), [status, toast]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const resolve = async () => {
    setSaving(true);
    try {
      const body = { action: acting.action };
      if (reason.trim()) body.reason = reason.trim();
      if (acting.action === 'suspend_author') body.days = Number(days) || 7;
      await api(`/admin/reports/posts/${acting.item.post_id}/resolve`, { method: 'POST', body });
      toast.success(acting.action === 'dismiss' ? 'Reports dismissed' : 'Action taken. The author has been notified.');
      setActing(null); setReason(''); setDays('7');
      load();
      window.dispatchEvent(new Event('kavach-refresh-counts'));
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Reported posts">Posts other students flagged as malicious, grouped by post. Posts with 5 or more reports are hidden automatically until you decide.</PageHeader>
      <Segmented label="Report status" className="mb-5" value={status} onChange={setStatus}
        options={[{ value: 'pending', label: 'Waiting for review' }, { value: 'actioned', label: 'Action taken' }, { value: 'dismissed', label: 'Dismissed' }]} />
      {!items ? <PageLoader /> : items.length === 0 ? (
        <div className="panel"><EmptyState icon={ShieldCheck} title={status === 'pending' ? 'No reports to review' : 'Nothing here yet'}>Reported posts will appear here.</EmptyState></div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <article key={it.post_id} className="panel overflow-hidden">
              <div className="grid gap-5 p-5 md:grid-cols-[1fr_300px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="signal"><Flag className="h-3.5 w-3.5" /> {it.reports.length} report{it.reports.length > 1 ? 's' : ''}</Badge>
                    {it.is_hidden && <Badge tone="brass"><EyeOff className="h-3.5 w-3.5" /> Hidden</Badge>}
                    {it.author_status !== 'active' && <Badge tone="signal">Author {it.author_status}</Badge>}
                  </div>
                  <h2 className="mt-2 text-lg font-bold"><Link to={`/problems?open=${it.post_id}`} className="hover:underline">{it.title}</Link></h2>
                  <p className="text-sm text-muted">By {it.author_name}{it.author_regd_no ? ` (${it.author_regd_no})` : ''}, posted {timeAgo(it.post_created_at)}</p>
                  <p className="mt-2 line-clamp-3 text-[15px]">{it.description}</p>
                  {it.images?.length > 0 && <div className="mt-3 flex gap-2">{it.images.slice(0, 4).map((src) => <img key={src} src={src} alt="" className="h-16 w-16 rounded-control object-cover" />)}</div>}
                </div>
                <div className="rounded-control bg-raised p-3.5">
                  <p className="text-sm font-bold">Why students reported it</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {it.reports.map((r) => (
                      <li key={r.id}><span className="font-bold">{REPORT_REASONS[r.reason]}</span> <span className="text-muted">by {r.reporter}, {timeAgo(r.created_at)}</span>{r.details && <span className="block text-muted">“{r.details}”</span>}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {status === 'pending' && (
                <div className="flex flex-wrap gap-2 border-t border-line bg-raised/50 px-5 py-3">
                  <Button size="sm" variant="outline" onClick={() => setActing({ item: it, action: 'dismiss' })}>Dismiss</Button>
                  <Button size="sm" variant="outline" onClick={() => setActing({ item: it, action: 'hide_post' })}>Hide post</Button>
                  <Button size="sm" variant="outline" className="text-signal" onClick={() => setActing({ item: it, action: 'suspend_author' })}>Suspend author</Button>
                  <Button size="sm" variant="danger" onClick={() => setActing({ item: it, action: 'ban_author' })}>Ban author</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <Modal open={Boolean(acting)} onClose={() => setActing(null)} size="sm" title={acting ? ACTIONS[acting.action].label : ''}
        footer={<><Button variant="ghost" onClick={() => setActing(null)}>Cancel</Button><Button variant={acting?.action === 'dismiss' ? 'primary' : 'danger'} loading={saving} onClick={resolve}>{acting ? ACTIONS[acting.action].label : ''}</Button></>}>
        {acting && (
          <div className="space-y-4">
            <p className="text-muted">{ACTIONS[acting.action].desc}</p>
            {acting.action === 'suspend_author' && <Input label="Suspend for (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} />}
            {acting.action !== 'dismiss' && <Textarea label="Reason shown to the author" optional placeholder="Violates community guidelines" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="min-h-[80px]" />}
          </div>
        )}
      </Modal>
    </div>
  );
}
