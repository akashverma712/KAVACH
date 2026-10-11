import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button, Input, Modal, Textarea } from './ui';

/** Suspend or ban a student account. action: 'suspend' | 'ban' */
export function ModerateUser({ user, action, onClose, onDone }) {
  const toast = useToast();
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDays('7'); setReason(''); setError(null); }, [user, action]);

  const submit = async () => {
    if (reason.trim().length < 3) { setError('Give a short reason. The student will see it.'); return; }
    setSaving(true);
    try {
      await api(`/admin/users/${user.id}/${action}`, { method: 'POST', body: action === 'suspend' ? { days: Number(days), reason: reason.trim() } : { reason: reason.trim() } });
      toast.success(action === 'ban' ? `${user.name} banned` : `${user.name} suspended for ${days} day${days === '1' ? '' : 's'}`);
      onDone?.();
      onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={Boolean(user && action)} onClose={onClose} size="sm" title={action === 'ban' ? `Ban ${user?.name}?` : `Suspend ${user?.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={saving} onClick={submit}>{action === 'ban' ? 'Ban account' : 'Suspend account'}</Button></>}>
      <p className="mb-4 text-muted">{action === 'ban' ? 'They will be signed out everywhere and can’t sign in again until you reinstate them.' : 'They will be signed out and blocked until the suspension ends.'}</p>
      <div className="space-y-4">
        {action === 'suspend' && <Input label="Days" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} />}
        <Textarea label="Reason" placeholder="Posting false information repeatedly" value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} maxLength={300} className="min-h-[80px]" error={error} />
      </div>
    </Modal>
  );
}
