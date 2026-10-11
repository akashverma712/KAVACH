import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { FilePicker } from '../components/FilePicker';
import { PostCard } from '../components/PostCard';
import { Button, Chip, EmptyState, Input, Modal, Segmented, Select, Skeleton, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { CATEGORIES, SEVERITY } from '../lib/format';

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'marked_for_solving', label: 'Marked for solving' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'under_review', label: 'Under review' },
  { value: 'solved', label: 'Solved' },
  { value: 'closed', label: 'Closed' },
];

function NewPostModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', category: 'safety', severity: '2' });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm({ title: '', description: '', category: 'safety', severity: '2' }); setFiles([]); setErrors({}); }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.title.trim().length < 5) er.title = 'Give it a short title (at least 5 characters)';
    if (form.description.trim().length < 10) er.description = 'Describe the problem in at least 10 characters';
    if (files.some((f) => f.size > 8 * 1024 * 1024)) er.files = 'Each photo must be under 8 MB';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      files.forEach((f) => fd.append('images', f));
      const r = await api('/posts', { method: 'POST', form: fd });
      toast.success('Problem posted. You’ll be notified when the admin updates it.');
      onCreated(r.id);
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Post a problem" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="new-post" loading={saving}>Post problem</Button></>}>
      <form id="new-post" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Title" placeholder="Streetlights not working near Hostel 3" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
        <Textarea label="What’s happening?" placeholder="Where is it, since when, and who is affected?" maxLength={3000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} hint={`${form.description.length}/3000`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <div>
            <p className="label">Severity</p>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Severity">
              {[1, 2, 3, 4].map((s) => (
                <button key={s} type="button" role="radio" aria-checked={form.severity === String(s)} onClick={() => setForm({ ...form, severity: String(s) })}
                  className={`h-11 rounded-control border text-[13px] font-bold transition-colors ${form.severity === String(s) ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink/40'}`}>
                  {SEVERITY[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <FilePicker label="Photos" files={files} onChange={setFiles} max={4} accept="image/jpeg,image/png,image/webp,image/gif" error={errors.files} hint="Up to 4 photos, 8 MB each" />
        {errors.form && <p className="rounded-control bg-signal/10 px-3 py-2.5 text-sm font-bold text-signal" role="alert">{errors.form}</p>}
        <p className="text-sm text-muted">Your name, branch and batch are shown with the post. Your phone and email are not.</p>
      </form>
    </Modal>
  );
}

export default function Community() {
  const navigate = useNavigate();
  const [sort, setSort] = useState('recent');
  const [status, setStatus] = useState('active');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [composing, setComposing] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (p = 1) => {
    const id = ++reqId.current;
    const params = new URLSearchParams({ sort, status, mine: String(mine), page: String(p) });
    if (query) params.set('q', query);
    if (p === 1) { setItems(null); setError(null); } else setLoadingMore(true);
    try {
      const d = await api(`/posts?${params}`);
      if (id !== reqId.current) return;
      setItems((prev) => (p === 1 ? d.items : [...(prev || []), ...d.items]));
      setHasMore(d.has_more);
      setPage(p);
    } catch (err) {
      if (id === reqId.current) { setError(err.message); setItems((prev) => prev || []); }
    } finally {
      setLoadingMore(false);
    }
  }, [sort, status, mine, query]);

  useEffect(() => { load(1); }, [load]);

  const update = (np) => setItems((list) => list.map((p) => (p.id === np.id ? np : p)));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.9rem] font-extrabold">Community</h1>
          <p className="text-muted">Problems raised by students, and where the college is on each one.</p>
        </div>
        <Button onClick={() => setComposing(true)}><MessageSquarePlus className="h-5 w-5" /> Post a problem</Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: 'recent', label: 'Recent' }, { value: 'severity', label: 'Severity' }, { value: 'popular', label: 'Popular' }]} />
        <div className="md:w-72"><Input aria-label="Search problems" icon={Search} placeholder="Search problems" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={mine} onClick={() => setMine((m) => !m)}>Posted by me</Chip>
        <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
        {STATUS_FILTERS.map((f) => <Chip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>{f.label}</Chip>)}
      </div>

      <div className="mt-5 space-y-4">
        {items === null && [0, 1, 2].map((i) => (
          <div key={i} className="panel p-5"><Skeleton className="h-9 w-1/2" /><Skeleton className="mt-4 h-5 w-3/4" /><Skeleton className="mt-2 h-4 w-full" /></div>
        ))}
        {error && items?.length === 0 && <p className="rounded-control bg-signal/10 px-4 py-3 font-bold text-signal">{error}</p>}
        {items?.length === 0 && !error && (
          <EmptyState icon={Users} title={query || mine || status !== 'active' ? 'Nothing matches these filters' : 'No problems posted yet'}
            action={<Button variant="outline" onClick={() => setComposing(true)}>Post the first one</Button>}>
            Spotted something unsafe or broken on campus? Post it so the admin can act on it.
          </EmptyState>
        )}
        {items?.map((p) => <PostCard key={p.id} post={p} onChange={update} />)}
        {hasMore && (
          <div className="flex justify-center pt-2"><Button variant="outline" loading={loadingMore} onClick={() => load(page + 1)}>Load more</Button></div>
        )}
      </div>

      <NewPostModal open={composing} onClose={() => setComposing(false)} onCreated={(id) => { setComposing(false); navigate(`/app/community/${id}`); }} />
    </div>
  );
}
