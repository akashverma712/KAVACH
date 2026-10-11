import { useCallback, useEffect, useState } from 'react';
import { Bot, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/kit';
import { Badge, Button, EmptyState, Input, Modal, PageLoader, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

const EMPTY = { question: '', answer: '', keywords: '', category: 'college' };

export default function Chatbot() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [test, setTest] = useState('');
  const [reply, setReply] = useState(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => api(`/admin/faqs?q=${encodeURIComponent(q)}`).then((d) => setItems(d.items)).catch((e) => toast.error(e.message)), [q, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const open = (f) => { setEditing(f || 'new'); setForm(f ? { question: f.question, answer: f.answer, keywords: f.keywords, category: f.category } : EMPTY); setError(null); };
  const save = async (e) => {
    e.preventDefault();
    if (form.question.trim().length < 5 || form.answer.trim().length < 5) { setError('Write both a question and an answer'); return; }
    setSaving(true);
    try {
      const body = { question: form.question.trim(), answer: form.answer.trim(), keywords: form.keywords.trim(), category: form.category.trim() || 'general' };
      if (editing === 'new') await api('/admin/faqs', { method: 'POST', body });
      else await api(`/admin/faqs/${editing.id}`, { method: 'PATCH', body });
      toast.success('Answer saved');
      setEditing(null); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const remove = async () => {
    try { await api(`/admin/faqs/${deleting.id}`, { method: 'DELETE' }); toast.success('Answer deleted'); setDeleting(null); load(); } catch (e) { toast.error(e.message); }
  };
  const runTest = async (e) => {
    e.preventDefault();
    if (!test.trim()) return;
    setTesting(true);
    try { setReply(await api('/admin/faqs/test', { method: 'POST', body: { message: test.trim() } })); } catch (err) { toast.error(err.message); } finally { setTesting(false); }
  };

  const groups = (items || []).reduce((acc, f) => { (acc[f.category] ||= []).push(f); return acc; }, {});

  return (
    <div>
      <PageHeader title="Chatbot answers" actions={<Button onClick={() => open(null)}><Plus className="h-4 w-4" /> Add answer</Button>}>
        The campus assistant answers students from these entries. Keywords help it match different ways of asking the same thing.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-4 max-w-sm"><Input aria-label="Search answers" icon={Search} placeholder="Search answers" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {!items ? <PageLoader /> : items.length === 0 ? (
            <div className="panel"><EmptyState icon={Bot} title="No answers yet">Add the questions students ask most often.</EmptyState></div>
          ) : Object.entries(groups).map(([cat, list]) => (
            <section key={cat} className="mb-6">
              <h2 className="mb-2 font-bold capitalize">{cat} <span className="font-normal text-muted">({list.length})</span></h2>
              <ul className="panel divide-y divide-line">
                {list.map((f) => (
                  <li key={f.id} className="flex gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{f.question}</p>
                      <p className="mt-1 line-clamp-2 text-[15px] text-muted">{f.answer}</p>
                      {f.keywords && <p className="mt-1.5 text-xs text-muted">Keywords: {f.keywords}</p>}
                    </div>
                    <div className="flex shrink-0 items-start">
                      <button type="button" onClick={() => open(f)} className="rounded-full p-2 text-muted hover:bg-raised hover:text-ink" aria-label="Edit answer"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setDeleting(f)} className="rounded-full p-2 text-muted hover:bg-signal/10 hover:text-signal" aria-label="Delete answer"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="panel p-5">
            <h2 className="font-bold">Try it as a student</h2>
            <p className="text-sm text-muted">See which answer a question would get.</p>
            <form onSubmit={runTest} className="mt-3 flex gap-2">
              <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="When are exams?" className="field-input" aria-label="Test question" />
              <Button type="submit" size="icon" className="h-[46px] w-[46px] shrink-0" loading={testing} aria-label="Ask">{!testing && <Send className="h-4 w-4" />}</Button>
            </form>
            {reply && (
              <div className="mt-4 rounded-control bg-raised p-3.5">
                <Badge tone={reply.source === 'fallback' ? 'brass' : 'neem'}>{{ knowledge_base: 'Matched an answer', ai: 'AI answer', fallback: 'No match found', safety: 'Safety response', smalltalk: 'Greeting' }[reply.source]}</Badge>
                {reply.matched && <p className="mt-2 text-sm text-muted">Matched: {reply.matched}</p>}
                <p className="mt-2 whitespace-pre-wrap text-[15px]">{reply.answer}</p>
              </div>
            )}
          </section>
        </aside>
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add answer' : 'Edit answer'} size="lg"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="faq-form" loading={saving}>Save answer</Button></>}>
        <form id="faq-form" onSubmit={save} className="space-y-4" noValidate>
          <Input label="Question" placeholder="What are the library timings?" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} maxLength={300} />
          <Textarea label="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} maxLength={3000} className="min-h-[140px]" />
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Input label="Keywords" optional placeholder="library timing hours open close" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} hint="Other words students might use" />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} hint="college, app, safety…" />
          </div>
          {error && <p className="text-sm font-bold text-signal">{error}</p>}
        </form>
      </Modal>
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} size="sm" title="Delete this answer?"
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete answer</Button></>}>
        <p className="text-muted">{deleting?.question}</p>
      </Modal>
    </div>
  );
}
