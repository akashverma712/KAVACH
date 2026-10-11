import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Flag, Mail, MessageSquareWarning, Phone, Search, Trash2 } from 'lucide-react';
import { Drawer, PageHeader, Pagination, TableShell, Td, Th } from '../components/kit';
import { ModerateUser } from '../components/ModerateUser';
import { Badge, Button, EmptyState, Input, Modal, PageLoader, Select, Spinner, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { CATEGORIES, REPORT_REASONS, SEVERITY, STATUS, dateTime, timeAgo } from '../lib/format';

const ADMIN_STATUSES = ['open', 'marked_for_solving', 'in_progress', 'under_review', 'solved'];

function ProblemDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const [hideReason, setHideReason] = useState('');
  const [moderate, setModerate] = useState(null);
  const [img, setImg] = useState(null);

  const load = useCallback(() => api(`/admin/posts/${id}`).then((x) => { setD(x); setStatus(x.post.status === 'closed' ? '' : x.post.status); }).catch((e) => toast.error(e.message)), [id, toast]);
  useEffect(() => { setD(null); setNote(''); load(); }, [load]);

  const updateStatus = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api(`/admin/posts/${id}/status`, { method: 'PATCH', body: { status, ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success(r.status === 'closed' ? 'Marked solved. The student had already confirmed, so it is now closed.' : `Status updated to “${STATUS[r.status].label}”. The student has been notified.`);
      setNote('');
      load(); onChanged();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const hide = async () => {
    if (hideReason.trim().length < 3) return;
    try {
      await api(`/admin/posts/${id}/hide`, { method: 'POST', body: { reason: hideReason.trim() } });
      toast.success('Post hidden from students');
      setHideOpen(false); setHideReason('');
      load(); onChanged();
    } catch (err) { toast.error(err.message); }
  };
  const unhide = async () => {
    try { await api(`/admin/posts/${id}/unhide`, { method: 'POST' }); toast.success('Post is visible again'); load(); onChanged(); } catch (err) { toast.error(err.message); }
  };
  const removeComment = async (cid) => {
    try { await api(`/admin/posts/${id}/comments/${cid}`, { method: 'DELETE' }); load(); } catch (err) { toast.error(err.message); }
  };

  const p = d?.post;
  return (
    <Drawer open onClose={onClose} title={p ? p.title : 'Loading…'} wide>
      {!d ? <div className="flex justify-center py-20"><Spinner /></div> : (
        <div className="space-y-7">
          <div className="flex flex-wrap gap-2">
            <Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge>
            <Badge tone={SEVERITY[p.severity].tone}>{SEVERITY[p.severity].label} severity</Badge>
            <Badge tone="muted">{CATEGORIES[p.category]}</Badge>
            {p.is_hidden && <Badge tone="brass"><EyeOff className="h-3.5 w-3.5" /> Hidden</Badge>}
            {p.report_count > 0 && <Badge tone="signal"><Flag className="h-3.5 w-3.5" /> {p.report_count} report{p.report_count > 1 ? 's' : ''}</Badge>}
          </div>

          <section className="rounded-panel bg-raised p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{p.author_name} <span className="font-normal text-muted">{p.author_regd_no || ''}</span></p>
                <p className="text-sm text-muted">{[p.author_branch, p.author_batch].filter(Boolean).join(', ')}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {p.author_phone && <a href={`tel:${p.author_phone}`} className="inline-flex items-center gap-1.5 font-bold"><Phone className="h-3.5 w-3.5" /> {p.author_phone}</a>}
                  {p.author_email && <a href={`mailto:${p.author_email}`} className="inline-flex items-center gap-1.5 font-bold"><Mail className="h-3.5 w-3.5" /> {p.author_email}</a>}
                </div>
              </div>
              {p.author_status === 'active' ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setModerate('suspend')}>Suspend</Button>
                  <Button size="sm" variant="outline" className="text-signal" onClick={() => setModerate('ban')}>Ban</Button>
                </div>
              ) : <Badge tone="signal">{p.author_status === 'banned' ? 'Banned' : 'Suspended'}</Badge>}
            </div>
          </section>

          <section>
            <p className="text-sm text-muted">Posted {dateTime(p.created_at)}</p>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{p.description}</p>
            {p.images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {p.images.map((src) => <button key={src} type="button" onClick={() => setImg(src)} className="aspect-square overflow-hidden rounded-control bg-raised"><img src={src} alt="" className="h-full w-full object-cover" /></button>)}
              </div>
            )}
            <p className="mt-3 text-sm text-muted">{p.reaction_total} reactions, {p.comment_count} comments</p>
          </section>

          {p.status !== 'closed' ? (
            <form onSubmit={updateStatus} className="rounded-panel border border-line p-4">
              <h3 className="font-bold">Update the student</h3>
              <p className="text-sm text-muted">They get a notification for every change. When you mark it solved, they’re asked to confirm before it closes.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
                <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {ADMIN_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                </Select>
                <Input label="Note to student" optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Electrician assigned, expected by Friday" />
              </div>
              <Button type="submit" className="mt-4" loading={saving} disabled={status === p.status && !note.trim()}>Send update</Button>
              {p.admin_resolved && !p.student_resolved && <p className="mt-3 text-sm text-muted">Waiting for the student to confirm it’s resolved.</p>}
            </form>
          ) : (
            <p className="rounded-panel bg-raised p-4 text-[15px]">Closed {p.closed_at ? timeAgo(p.closed_at) : ''} {p.closed_by === 'mutual' ? 'after you and the student both marked it resolved' : p.closed_by === 'owner' ? 'by the student who raised it' : ''}.</p>
          )}

          <section>
            <h3 className="font-bold">Timeline</h3>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-5">
              {d.updates.map((u) => (
                <li key={u.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-ink" />
                  <p className="text-[15px]"><span className="font-bold">{STATUS[u.status]?.label || u.status}</span> <span className="text-muted">by {u.actor === 'owner' ? 'student' : u.actor}, {dateTime(u.created_at)}</span></p>
                  {u.note && <p className="text-[15px] text-muted">{u.note}</p>}
                </li>
              ))}
            </ol>
          </section>

          {d.reports.length > 0 && (
            <section>
              <h3 className="font-bold">Reports</h3>
              <ul className="mt-3 divide-y divide-line rounded-panel border border-line">
                {d.reports.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-[15px]">
                    <p><span className="font-bold">{REPORT_REASONS[r.reason]}</span> <span className="text-muted">by {r.reporter_name}, {timeAgo(r.created_at)}</span> <Badge tone={r.status === 'pending' ? 'signal' : 'muted'}>{r.status}</Badge></p>
                    {r.details && <p className="text-muted">{r.details}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-bold">Comments ({d.comments.filter((c) => !c.is_deleted).length})</h3>
            <ul className="mt-3 space-y-2">
              {d.comments.length === 0 && <li className="text-muted">No comments.</li>}
              {d.comments.map((c) => (
                <li key={c.id} className={`flex items-start gap-3 rounded-control border border-line px-3.5 py-2.5 ${c.is_deleted ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1 text-[15px]">
                    <p className="text-sm"><span className="font-bold">{c.author_name}</span> <span className="text-muted">{timeAgo(c.created_at)}{c.is_deleted ? ', removed' : ''}</span></p>
                    <p className="break-words">{c.body}</p>
                  </div>
                  {!c.is_deleted && <button type="button" onClick={() => removeComment(c.id)} className="text-muted hover:text-signal" aria-label="Remove comment"><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
          </section>

          <div className="border-t border-line pt-5">
            {p.is_hidden
              ? <><p className="mb-3 text-sm text-muted">Hidden: {p.hidden_reason}</p><Button variant="outline" onClick={unhide}><Eye className="h-4 w-4" /> Make visible again</Button></>
              : <Button variant="outline" className="text-signal" onClick={() => setHideOpen(true)}><EyeOff className="h-4 w-4" /> Hide from students</Button>}
          </div>
        </div>
      )}
      <Modal open={hideOpen} onClose={() => setHideOpen(false)} title="Hide this post" size="sm"
        footer={<><Button variant="ghost" onClick={() => setHideOpen(false)}>Cancel</Button><Button variant="danger" onClick={hide} disabled={hideReason.trim().length < 3}>Hide post</Button></>}>
        <Textarea label="Reason (shown to the author)" value={hideReason} onChange={(e) => setHideReason(e.target.value)} maxLength={300} className="min-h-[80px]" />
      </Modal>
      {p && <ModerateUser user={moderate ? { id: p.user_id, name: p.author_name } : null} action={moderate} onClose={() => setModerate(null)} onDone={load} />}
      {img && <button type="button" className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 p-6" onClick={() => setImg(null)} aria-label="Close image"><img src={img} alt="" className="max-h-full max-w-full rounded-control" /></button>}
    </Drawer>
  );
}

export default function Problems() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState({ sort: 'recent', status: 'active', severity: 'all', visibility: 'all' });
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const openId = params.get('open');

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ ...f, page: String(page) });
    if (query) qs.set('q', query);
    return api(`/admin/posts?${qs}`).then(setData).catch((e) => toast.error(e.message));
  }, [f, page, query, toast]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };

  return (
    <div>
      <PageHeader title="Problems">Track what students raise, update them as work progresses, and sort by when it was posted or how severe it is.</PageHeader>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1"><Input aria-label="Search" icon={Search} placeholder="Search title or student" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Sort" value={f.sort} onChange={setFilter('sort')}>
          <option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="severity">Most severe first</option><option value="reports">Most reported first</option>
        </Select>
        <Select aria-label="Status" value={f.status} onChange={setFilter('status')}>
          <option value="active">All active</option><option value="all">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select aria-label="Severity" value={f.severity} onChange={setFilter('severity')}>
          <option value="all">Any severity</option>
          {[4, 3, 2, 1].map((s) => <option key={s} value={s}>{SEVERITY[s].label}</option>)}
        </Select>
        <Select aria-label="Visibility" value={f.visibility} onChange={setFilter('visibility')}>
          <option value="all">Visible and hidden</option><option value="visible">Visible only</option><option value="hidden">Hidden only</option>
        </Select>
      </div>

      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <div className="panel"><EmptyState icon={MessageSquareWarning} title="No problems match">Try changing the filters.</EmptyState></div>
      ) : (
        <TableShell footer={<Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}>
          <thead className="border-b border-line bg-raised"><tr><Th>Problem</Th><Th>Severity</Th><Th>Status</Th><Th>Student</Th><Th>Activity</Th><Th>Posted</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.items.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-raised" onClick={() => setParams({ open: p.id })}>
                <Td className="max-w-[340px]">
                  <button type="button" className="block w-full text-left font-bold hover:underline" onClick={(e) => { e.stopPropagation(); setParams({ open: p.id }); }}>
                    <span className="line-clamp-1">{p.title}</span>
                  </button>
                  <span className="flex items-center gap-2 text-sm text-muted">{CATEGORIES[p.category]}{p.is_hidden && <span className="inline-flex items-center gap-1 text-brass"><EyeOff className="h-3.5 w-3.5" /> hidden</span>}{p.report_count > 0 && <span className="inline-flex items-center gap-1 text-signal"><Flag className="h-3.5 w-3.5" /> {p.report_count}</span>}</span>
                </Td>
                <Td><span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${SEVERITY[p.severity].bar}`} />{SEVERITY[p.severity].label}</span></Td>
                <Td><Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge></Td>
                <Td className="whitespace-nowrap">{p.author_name}</Td>
                <Td className="whitespace-nowrap text-muted">{p.reaction_total} reactions, {p.comment_count} comments</Td>
                <Td className="whitespace-nowrap text-muted">{timeAgo(p.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      {openId && <ProblemDrawer id={openId} onClose={() => setParams({})} onChanged={() => { load(); window.dispatchEvent(new Event('kavach-refresh-counts')); }} />}
    </div>
  );
}
