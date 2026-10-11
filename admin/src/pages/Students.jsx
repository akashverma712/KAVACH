import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, GraduationCap, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { PageHeader, Pagination, TableShell, Td, Th } from '../components/kit';
import { Badge, Button, EmptyState, Input, Modal, PageLoader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

const EMPTY = { name: '', branch: '', batch: '', regd_no: '', email: '', phone: '' };
const TEMPLATE = 'name,branch,batch,regd_no,email,phone\nAarav Kumar,Computer Science & Engineering,2022-2026,22CSE001,aarav.22cse001@bitsindri.ac.in,9000000001\nPriya Singh,Electronics & Communication Engineering,2023-2027,23ECE014,,9000000002\n';

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'kavach-student-roster-template.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StudentForm({ record, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (record) setForm(record === 'new' ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map((k) => [k, record[k] || ''])));
    setError(null);
  }, [record]);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError(null); };
  const save = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2 || form.regd_no.trim().length < 2) { setError('Name and registration number are required'); return; }
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      if (record === 'new') await api('/admin/students', { method: 'POST', body });
      else await api(`/admin/students/${record.id}`, { method: 'PATCH', body });
      toast.success(record === 'new' ? 'Student added to the roster' : 'Student updated');
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open={Boolean(record)} onClose={onClose} title={record === 'new' ? 'Add student' : 'Edit student'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="student-form" loading={saving}>{record === 'new' ? 'Add student' : 'Save changes'}</Button></>}>
      <form id="student-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2"><Input label="Full name" value={form.name} onChange={set('name')} /></div>
        <Input label="Registration number" value={form.regd_no} onChange={set('regd_no')} />
        <Input label="Batch" placeholder="2022-2026" value={form.batch} onChange={set('batch')} />
        <div className="sm:col-span-2"><Input label="Branch" placeholder="Computer Science & Engineering" value={form.branch} onChange={set('branch')} /></div>
        <Input label="Email" optional type="email" value={form.email} onChange={set('email')} />
        <Input label="Phone" optional type="tel" value={form.phone} onChange={set('phone')} />
        <p className="text-sm text-muted sm:col-span-2">Students can register only with an email or phone number listed here, or with an @bitsindri.ac.in email.</p>
        {error && <p className="text-sm font-bold text-signal sm:col-span-2" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

const ACTION_BADGE = { new: ['neem', 'New'], update: ['ink', 'Update'], skip: ['signal', 'Skipped'] };

function ImportModal({ open, onClose, onDone }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);

  useEffect(() => { if (open) { setFile(null); setPreview(null); setResult(null); setError(null); } }, [open]);

  const scan = async (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) { setError('Choose a .csv or .xlsx file'); return; }
    setFile(f); setError(null); setPreview(null); setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      setPreview(await api('/admin/students/import/preview', { method: 'POST', form: fd }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api('/admin/students/import/commit', { method: 'POST', form: fd });
      setResult(r);
      toast.success(`Imported: ${r.inserted} added, ${r.updated} updated`);
      onDone();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const rows = preview ? (onlyIssues ? preview.rows.filter((r) => r.errors.length) : preview.rows) : [];
  const importable = preview ? preview.summary.new + preview.summary.update : 0;

  return (
    <Modal open={open} onClose={onClose} title="Import students from a file" size="lg"
      footer={result ? <Button onClick={onClose}>Done</Button> : (
        <><Button variant="ghost" onClick={onClose}>Cancel</Button>
          {preview && <Button loading={busy} disabled={!importable} onClick={commit}>Import {importable} student{importable === 1 ? '' : 's'}</Button>}</>
      )}>
      {result ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-neem" />
          <p className="mt-3 text-lg font-bold">{result.inserted} added, {result.updated} updated</p>
          {result.skipped.length > 0 && (
            <div className="mt-4 text-left">
              <p className="font-bold">{result.skipped.length} row{result.skipped.length > 1 ? 's' : ''} skipped</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-muted">{result.skipped.map((s) => <li key={s.line}>Line {s.line}: {s.error}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); scan(e.dataTransfer.files?.[0]); }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed px-6 py-8 text-center transition-colors ${drag ? 'border-ink bg-raised' : 'border-line hover:border-ink/40'}`}>
            <FileSpreadsheet className="h-9 w-9 text-muted" />
            <p className="mt-2 font-bold">{file ? file.name : 'Drop a CSV or Excel file here, or click to choose'}</p>
            <p className="text-sm text-muted">Columns: name, branch, batch, regd_no, email, phone. Common header names like “Reg No” or “Mobile” are recognised.</p>
            <input ref={inputRef} type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => { scan(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"><Download className="h-4 w-4" /> Download a template</button>
          {busy && !preview && <p className="text-muted">Scanning file…</p>}
          {error && <p className="rounded-control bg-signal/10 px-3 py-2.5 text-sm font-bold text-signal" role="alert">{error}</p>}
          {preview && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="font-bold">{preview.summary.total} rows found:</span>
                <Badge tone="neem">{preview.summary.new} new</Badge>
                <Badge tone="ink">{preview.summary.update} updates</Badge>
                {preview.summary.skip > 0 && <Badge tone="signal">{preview.summary.skip} with problems</Badge>}
                {preview.summary.skip > 0 && (
                  <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Show only rows with problems</label>
                )}
              </div>
              <div className="max-h-80 overflow-auto rounded-control border border-line">
                <table className="w-full text-sm [&_td]:whitespace-nowrap">
                  <thead className="sticky top-0 bg-raised"><tr><Th>Line</Th><Th>Result</Th><Th>Name</Th><Th>Regd. no</Th><Th>Branch</Th><Th>Batch</Th><Th>Email</Th><Th>Phone</Th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, 500).map((r) => (
                      <tr key={r.line} className={r.errors.length ? 'bg-signal/5' : ''}>
                        <Td className="text-muted">{r.line}</Td>
                        <Td><Badge tone={ACTION_BADGE[r.action][0]}>{ACTION_BADGE[r.action][1]}</Badge>{r.errors.length > 0 && <p className="mt-1 max-w-[200px] whitespace-normal text-xs font-bold text-signal">{r.errors.join('; ')}</p>}</Td>
                        <Td className="whitespace-nowrap">{r.data.name}</Td><Td>{r.data.regd_no}</Td><Td>{r.data.branch}</Td><Td>{r.data.batch}</Td><Td>{r.data.email}</Td><Td>{r.data.phone}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 500 && <p className="text-sm text-muted">Showing the first 500 rows. All valid rows will be imported.</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Students() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => api(`/admin/students?page=${page}&q=${encodeURIComponent(query)}`).then(setData).catch((e) => toast.error(e.message)), [page, query, toast]);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try { await api(`/admin/students/${deleting.id}`, { method: 'DELETE' }); toast.success(`${deleting.name} removed from the roster`); setDeleting(null); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Student roster"
        actions={<><Button variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4" /> Import CSV or Excel</Button><Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add student</Button></>}>
        The college records students register against. Their name, branch, batch and registration number are filled into their profile automatically.
      </PageHeader>
      <div className="mb-4 max-w-sm"><Input aria-label="Search roster" icon={Search} placeholder="Search name, regd. no, email, phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <div className="panel"><EmptyState icon={GraduationCap} title={query ? 'No students match' : 'The roster is empty'} action={!query && <Button variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4" /> Import a file</Button>}>Import the college’s student list so students can register.</EmptyState></div>
      ) : (
        <TableShell footer={<Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}>
          <thead className="border-b border-line bg-raised"><tr><Th>Name</Th><Th>Regd. no</Th><Th>Branch</Th><Th>Batch</Th><Th>Email</Th><Th>Phone</Th><Th>Account</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.items.map((s) => (
              <tr key={s.id} className="hover:bg-raised/60">
                <Td className="whitespace-nowrap font-bold">{s.name}</Td>
                <Td className="whitespace-nowrap">{s.regd_no}</Td>
                <Td className="max-w-[220px] truncate">{s.branch || <span className="text-muted">–</span>}</Td>
                <Td className="whitespace-nowrap">{s.batch || <span className="text-muted">–</span>}</Td>
                <Td className="max-w-[240px] truncate">{s.email || <span className="text-muted">–</span>}</Td>
                <Td className="whitespace-nowrap">{s.phone || <span className="text-muted">–</span>}</Td>
                <Td>{s.registered ? <Badge tone="neem">Registered</Badge> : <Badge tone="muted">Not yet</Badge>}</Td>
                <Td className="whitespace-nowrap text-right">
                  <button type="button" onClick={() => setEditing(s)} className="rounded-full p-2 text-muted hover:bg-raised hover:text-ink" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDeleting(s)} className="rounded-full p-2 text-muted hover:bg-signal/10 hover:text-signal" aria-label={`Remove ${s.name}`}><Trash2 className="h-4 w-4" /></button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <StudentForm record={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      <ImportModal open={importing} onClose={() => setImporting(false)} onDone={load} />
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} size="sm" title={`Remove ${deleting?.name}?`}
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Remove from roster</Button></>}>
        <p className="text-muted">New registrations with their email or phone will no longer be accepted. An existing account stays active.</p>
      </Modal>
    </div>
  );
}
