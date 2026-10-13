import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, EyeOff, Flag, Lock, Send, Trash2, Users, XCircle } from 'lucide-react';
import { ImageLightbox } from '../components/ImageLightbox';
import { LikeButton } from '../components/LikeButton';
import { Avatar, Badge, Button, EmptyState, Modal, PageLoader, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { CATEGORIES, REPORT_REASONS, SEVERITY, STATUS, dateTime, timeAgo } from '../lib/format';

const UPDATE_TEXT = {
  open: 'Posted',
  marked_for_solving: 'Marked for solving',
  in_progress: 'Work in progress',
  under_review: 'Under review',
  solved: 'Marked solved by admin',
  closed: 'Closed',
};

function ReportModal({ open, onClose, postId, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (!reason) { setError('Choose a reason'); return; }
    setSaving(true);
    try {
      await api(`/posts/${postId}/report`, { method: 'POST', body: { reason, ...(details.trim() ? { details: details.trim() } : {}) } });
      toast.success('Thanks. The admin will review this post.');
      onDone();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report this post" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={saving} onClick={submit}>Send report</Button></>}>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-muted">Why are you reporting it? The author won’t see who reported.</legend>
        {Object.entries(REPORT_REASONS).map(([k, l]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-control border px-3.5 py-3 ${reason === k ? 'border-ink' : 'border-line'}`}>
            <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => { setReason(k); setError(null); }} className="accent-current" />
            {l}
          </label>
        ))}
      </fieldset>
      <div className="mt-4"><Textarea label="Details" optional value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} className="min-h-[80px]" /></div>
      {error && <p className="mt-3 text-sm font-bold text-signal">{error}</p>}
    </Modal>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [post, setPost] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [confirm, setConfirm] = useState(null); // close | delete | reopen
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api(`/posts/${id}`), api(`/posts/${id}/comments`)]);
      setPost(d.post); setUpdates(d.updates); setComments(c.items || []);
    } catch (err) { setError(err); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (post && window.location.hash === '#comments') document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
  }, [post]);

  const comment = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const r = await api(`/posts/${id}/comments`, { method: 'POST', body: { body: body.trim() } });
      setComments((c) => [...c, r.comment]);
      setPost((p) => ({ ...p, comment_count: p.comment_count + 1 }));
      setBody('');
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  const removeComment = async (cid) => {
    try {
      await api(`/posts/${id}/comments/${cid}`, { method: 'DELETE' });
      setComments((c) => c.filter((x) => x.id !== cid));
    } catch (err) { toast.error(err.message); }
  };

  const act = async (kind) => {
    setActing(true);
    try {
      if (kind === 'delete') {
        await api(`/posts/${id}`, { method: 'DELETE' });
        toast.success('Problem deleted');
        navigate('/app/community', { replace: true });
        return;
      }
      if (kind === 'confirm') await api(`/posts/${id}/confirm-resolved`, { method: 'POST' });
      if (kind === 'close') await api(`/posts/${id}/close`, { method: 'POST', body: note.trim() ? { note: note.trim() } : {} });
      if (kind === 'reopen') await api(`/posts/${id}/reopen`, { method: 'POST', body: note.trim() ? { note: note.trim() } : {} });
      toast.success({ confirm: 'Thanks for confirming. The problem is now closed.', close: 'Problem closed', reopen: 'Sent back to the admin for review' }[kind]);
      setConfirm(null); setNote('');
      load();
    } catch (err) { toast.error(err.message); } finally { setActing(false); }
  };

  if (error) {
    return <EmptyState icon={XCircle} title={error.status === 404 ? 'This problem isn’t available' : 'Couldn’t load this problem'} action={<Link to="/app/community" className="font-bold underline">Back to Community</Link>}>{error.message}</EmptyState>;
  }
  if (!post) return <PageLoader />;

  const sev = SEVERITY[post.severity] || SEVERITY[1];
  const closed = post.status === 'closed';
  const isAdminOnly = post.visibility === 'admin';

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/community" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Community</Link>

      <article className="panel relative mt-3 overflow-hidden">
        <span className={`absolute inset-y-0 left-0 w-1.5 ${sev.bar}`} aria-hidden />
        <div className="p-5 pl-6 sm:p-7 sm:pl-8">
          {post.is_hidden && (
            <p className="mb-4 flex items-start gap-2 rounded-control bg-brass/15 px-3 py-2.5 text-sm font-bold text-brass"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" /> Only you can see this post. {post.hidden_reason}</p>
          )}

          {isAdminOnly && (
            <div className="mb-4 flex items-start gap-2.5 rounded-control bg-raised border border-line p-3.5 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
              <div>
                <p className="font-bold text-ink">Private Problem (Admin only)</p>
                <p className="text-muted text-xs sm:text-sm">
                  Only you and the campus admin can see this problem. Likes and comments are turned off. The admin will follow up through progress updates below.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isAdminOnly ? (
              <Badge tone="ink"><Lock className="h-3 w-3 mr-1 inline" /> Admin only</Badge>
            ) : (
              <Badge tone="muted"><Users className="h-3 w-3 mr-1 inline" /> Everyone</Badge>
            )}
            <Badge tone={STATUS[post.status].tone} dot>{STATUS[post.status].label}</Badge>
            <Badge tone={sev.tone}>{sev.label} severity</Badge>
            <Badge tone="muted">{CATEGORIES[post.category]}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-[1.75rem]">{post.title}</h1>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={post.author_name} size={36} />
            <p className="text-[15px]"><span className="font-bold">{post.author_name}</span><span className="text-muted">{post.author_branch ? `, ${post.author_branch}` : ''}{post.author_batch ? `, ${post.author_batch}` : ''}</span><br /><span className="text-sm text-muted">{dateTime(post.created_at)}</span></p>
          </div>
          <p className="mt-5 whitespace-pre-wrap text-[16px] leading-relaxed">{post.description}</p>

          {post.images?.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {post.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setLightbox(i)} className="aspect-square overflow-hidden rounded-control bg-raised" aria-label={`Open photo ${i + 1}`}>
                  <img src={src} alt="" className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {isAdminOnly ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <Lock className="h-4 w-4" /> Private problem — student responses are turned off
              </span>
            ) : (
              <>
                <LikeButton post={post} onChange={setPost} size="md" />
                {!post.is_owner && (
                  post.i_reported
                    ? <span className="text-sm text-muted">You reported this post</span>
                    : <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-signal"><Flag className="h-4 w-4" /> Report</button>
                )}
              </>
            )}
          </div>
        </div>
      </article>

      {post.is_owner && post.status === 'solved' && (
        <section className="mt-4 rounded-panel border-2 border-neem/50 bg-neem/10 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-5 w-5 text-neem" /> The admin marked this solved</h2>
          <p className="mt-1 text-muted">Is the problem actually fixed? Confirming closes it for good.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="success" loading={acting} onClick={() => act('confirm')}>Yes, it’s resolved</Button>
            <Button variant="outline" onClick={() => setConfirm('reopen')}>Not yet</Button>
          </div>
        </section>
      )}

      {post.is_owner && !closed && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirm('close')}><Lock className="h-4 w-4" /> Close problem</Button>
          <Button variant="ghost" size="sm" className="text-signal" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      )}

      <section className="mt-8" aria-labelledby="progress-title">
        <h2 id="progress-title" className="text-lg font-bold">Progress</h2>
        <ol className="relative mt-4 space-y-5 border-l-2 border-line pl-6">
          {updates.map((u, i) => (
            <li key={u.id} className="relative">
              <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-[3px] border-bg ${i === updates.length - 1 ? (u.status === 'solved' || u.status === 'closed' ? 'bg-neem' : 'bg-ink') : 'bg-line'}`} aria-hidden />
              <p className="font-bold">{UPDATE_TEXT[u.status] || u.status}<span className="font-normal text-muted"> {u.actor === 'admin' ? 'by admin' : u.actor === 'owner' ? 'by student' : ''}</span></p>
              {u.note && <p className="mt-0.5 text-[15px]">{u.note}</p>}
              <p className="text-sm text-muted">{dateTime(u.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>

      {!isAdminOnly && (
        <section id="comments" className="mt-10 scroll-mt-20" aria-labelledby="comments-title">
          <h2 id="comments-title" className="text-lg font-bold">Discussion <span className="font-normal text-muted">({comments.length})</span></h2>
          <ul className="mt-4 space-y-4">
            {comments.length === 0 && <li className="text-muted">No comments yet. Facing the same thing? Say so here.</li>}
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar name={c.author_name} size={34} />
                <div className="min-w-0 flex-1 rounded-panel rounded-tl-md bg-surface px-4 py-3 border border-line">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm"><span className="font-bold">{c.author_name}</span><span className="text-muted">{c.author_branch ? `, ${c.author_branch}` : ''}, {timeAgo(c.created_at)}</span></p>
                    {c.is_mine && <button type="button" onClick={() => removeComment(c.id)} className="text-muted hover:text-signal" aria-label="Delete comment"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[15px]">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
          {closed ? (
            <p className="mt-5 flex items-center gap-2 text-muted"><Lock className="h-4 w-4" /> This problem is closed, so new comments are off.</p>
          ) : (
            <form onSubmit={comment} className="mt-5 flex items-end gap-2">
              <label htmlFor="comment" className="sr-only">Write a comment</label>
              <textarea id="comment" rows={1} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Add to the discussion…"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) comment(e); }}
                className="field-input min-h-[46px] flex-1 resize-none" />
              <Button type="submit" size="icon" className="h-[46px] w-[46px] shrink-0" loading={sending} disabled={!body.trim()} aria-label="Send comment">{!sending && <Send className="h-5 w-5" />}</Button>
            </form>
          )}
        </section>
      )}

      <ImageLightbox images={post.images} index={lightbox} onClose={() => setLightbox(null)} />
      <ReportModal open={reporting} onClose={() => setReporting(false)} postId={post.id} onDone={() => { setReporting(false); setPost((p) => ({ ...p, i_reported: true })); }} />
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} size="sm"
        title={{ close: 'Close this problem?', delete: 'Delete this problem?', reopen: 'Tell the admin it’s not fixed' }[confirm] || ''}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant={confirm === 'delete' ? 'danger' : 'primary'} loading={acting} onClick={() => act(confirm)}>
            {{ close: 'Close problem', delete: 'Delete problem', reopen: 'Send back for review' }[confirm]}
          </Button></>}>
        {confirm === 'delete' && <p className="text-muted">The post, its photos, reactions and comments will be removed permanently.</p>}
        {confirm !== 'delete' && (
          <>
            <p className="mb-4 text-muted">{confirm === 'close' ? 'You can close your own problem at any time. Comments will be turned off.' : 'The admin will see your note and look at it again.'}</p>
            <Textarea label={confirm === 'close' ? 'Reason' : 'What’s still wrong?'} optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="min-h-[80px]" />
          </>
        )}
      </Modal>
    </div>
  );
}
