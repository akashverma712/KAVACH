import { useState } from 'react';
import { Lock, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useSos } from '../context/SosContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Modal } from './ui';

const empty = { name: '', phone: '', relation: '' };

export function ContactsManager({ compact = false }) {
  const { contacts, setContacts } = useSos();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | contact
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const list = contacts?.contacts || [];
  const system = contacts?.system || [];
  const max = contacts?.max || 5;

  const open = (c) => {
    setEditing(c || 'new');
    setForm(c ? { name: c.name, phone: c.phone, relation: c.relation || '' } : empty);
    setErrors({});
  };

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter a name';
    if (form.phone.replace(/\D/g, '').length < 8) errs.phone = 'Enter a phone number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { name: form.name, phone: form.phone, relation: form.relation || null };
      const d = editing === 'new'
        ? await api('/me/contacts', { method: 'POST', body })
        : await api(`/me/contacts/${editing.id}`, { method: 'PATCH', body });
      setContacts(d);
      toast.success(editing === 'new' ? 'Contact added' : 'Contact updated');
      setEditing(null);
    } catch (err) {
      setErrors({ phone: err.code === 'INVALID_PHONE' || err.code === 'CONTACT_EXISTS' ? err.message : undefined, form: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    setRemoving(c.id);
    try {
      setContacts(await api(`/me/contacts/${c.id}`, { method: 'DELETE' }));
      toast.success(`${c.name} removed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      <ul className="divide-y divide-line">
        {system.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-bg"><Lock className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{c.name}</p>
              <p className="text-sm text-muted">{c.phone}, always included</p>
            </div>
            <a href={`tel:${c.phone}`} className="rounded-full p-2 text-muted hover:bg-raised hover:text-ink" aria-label={`Call ${c.name}`}><Phone className="h-[18px] w-[18px]" /></a>
          </li>
        ))}
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-muted"><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{c.name}{c.relation && <span className="font-normal text-muted">, {c.relation}</span>}</p>
              <p className="text-sm text-muted">{c.phone}</p>
            </div>
            {!compact && <a href={`tel:${c.phone}`} className="rounded-full p-2 text-muted hover:bg-raised hover:text-ink" aria-label={`Call ${c.name}`}><Phone className="h-[18px] w-[18px]" /></a>}
            <button type="button" onClick={() => open(c)} className="rounded-full p-2 text-muted hover:bg-raised hover:text-ink" aria-label={`Edit ${c.name}`}><Pencil className="h-[18px] w-[18px]" /></button>
            <button type="button" onClick={() => remove(c)} disabled={removing === c.id} className="rounded-full p-2 text-muted hover:bg-signal/10 hover:text-signal disabled:opacity-50" aria-label={`Remove ${c.name}`}><Trash2 className="h-[18px] w-[18px]" /></button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="pb-2 pt-1 text-sm text-muted">Add family or friends who should get your location in an emergency.</p>}
      {list.length < max ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={() => open(null)}><Plus className="h-4 w-4" /> Add contact</Button>
      ) : <p className="mt-2 text-sm text-muted">You've added the maximum of {max} contacts.</p>}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add emergency contact' : 'Edit emergency contact'} size="sm"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="contact-form" loading={saving}>{editing === 'new' ? 'Add contact' : 'Save contact'}</Button></>}>
        <form id="contact-form" onSubmit={save} className="space-y-4" noValidate>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="off" />
          <Input label="Phone number" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} hint="10-digit mobile, or +country code for numbers outside India" />
          <Input label="Relation" optional value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Mother, roommate…" />
          {errors.form && !errors.phone && <p className="text-sm font-bold text-signal">{errors.form}</p>}
        </form>
      </Modal>
    </div>
  );
}
