import { useCallback, useEffect, useState } from 'react';
import { Search, UserCog } from 'lucide-react';
import { PageHeader, Pagination, TableShell, Td, Th } from '../components/kit';
import { ModerateUser } from '../components/ModerateUser';
import { Badge, Button, EmptyState, Input, PageLoader, Select } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { dateTime, timeAgo } from '../lib/format';

export default function Users() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [moderate, setModerate] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => api(`/admin/users?page=${page}&q=${encodeURIComponent(query)}${status !== 'all' ? `&status=${status}` : ''}`).then(setData).catch((e) => toast.error(e.message)), [page, query, status, toast]);
  useEffect(() => { load(); }, [load]);

  const reinstate = async (u) => {
    try { await api(`/admin/users/${u.id}/reinstate`, { method: 'POST' }); toast.success(`${u.name} can sign in again`); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Student accounts">Everyone who has registered. Suspend or ban accounts that post malicious content; they are signed out immediately.</PageHeader>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-full max-w-sm"><Input aria-label="Search accounts" icon={Search} placeholder="Search name, email, phone, regd. no" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="w-48"><Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
        </Select></div>
      </div>
      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <div className="panel"><EmptyState icon={UserCog} title="No accounts match">Students appear here after they register.</EmptyState></div>
      ) : (
        <TableShell footer={<Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}>
          <thead className="border-b border-line bg-raised"><tr><Th>Student</Th><Th>Contact</Th><Th>Activity</Th><Th>Status</Th><Th>Joined</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-raised/60">
                <Td>
                  <p className="whitespace-nowrap font-bold">{u.name}</p>
                  <p className="whitespace-nowrap text-sm text-muted">{[u.regd_no, u.branch].filter(Boolean).join(', ') || 'No college details'}</p>
                </Td>
                <Td className="text-sm"><p>{u.email || '–'}</p><p className="text-muted">{u.phone || '–'}</p></Td>
                <Td className="whitespace-nowrap text-sm text-muted">{u.post_count} posts, {u.sos_count} SOS{u.reports_against > 0 && <span className="block font-bold text-signal">{u.reports_against} reports against</span>}</Td>
                <Td>
                  {u.status === 'active' && <Badge tone="neem">Active</Badge>}
                  {u.status === 'suspended' && <><Badge tone="brass">Suspended</Badge><p className="mt-1 text-xs text-muted">until {dateTime(u.suspended_until)}</p></>}
                  {u.status === 'banned' && <Badge tone="signal">Banned</Badge>}
                  {u.moderation_reason && <p className="mt-1 max-w-[200px] text-xs text-muted">{u.moderation_reason}</p>}
                </Td>
                <Td className="whitespace-nowrap text-sm text-muted">{timeAgo(u.created_at)}{!u.college_verified && <span className="block text-brass">Not on roster</span>}</Td>
                <Td className="whitespace-nowrap text-right">
                  {u.status === 'active' ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setModerate({ user: u, action: 'suspend' })}>Suspend</Button>
                      <Button size="sm" variant="outline" className="text-signal" onClick={() => setModerate({ user: u, action: 'ban' })}>Ban</Button>
                    </div>
                  ) : <Button size="sm" variant="outline" onClick={() => reinstate(u)}>Reinstate</Button>}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <ModerateUser user={moderate?.user} action={moderate?.action} onClose={() => setModerate(null)} onDone={load} />
    </div>
  );
}
