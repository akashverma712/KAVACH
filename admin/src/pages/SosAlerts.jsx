import { useCallback, useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Check, ExternalLink, Mic, MousePointerClick, Phone, RefreshCw, WifiOff } from 'lucide-react';
import { PageHeader, Pagination } from '../components/kit';
import { Badge, Button, EmptyState, Modal, PageLoader, Segmented, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { dateTime, timeAgo } from '../lib/format';

const CAMPUS = [23.6524, 86.4897];
const TRIGGER = { button: { label: 'Button', icon: MousePointerClick }, voice: { label: 'Voice “help”', icon: Mic }, offline_sync: { label: 'Sent after reconnecting', icon: WifiOff } };

export default function SosAlerts() {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [ack, setAck] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => api(`/admin/sos?filter=${filter}&page=${page}`).then(setData).catch((e) => toast.error(e.message)), [filter, page, toast]);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const acknowledge = async () => {
    setSaving(true);
    try {
      await api(`/admin/sos/${ack.id}/acknowledge`, { method: 'POST', body: note.trim() ? { note: note.trim() } : {} });
      toast.success('Marked as responded');
      setAck(null); setNote('');
      load();
      window.dispatchEvent(new Event('kavach-refresh-counts'));
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!data) return <PageLoader />;
  const located = data.items.filter((a) => a.lat !== null);

  return (
    <div>
      <PageHeader title="SOS alerts" actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>}>
        Every alert students send, with their location. This page refreshes every 15 seconds.
      </PageHeader>

      <div className="relative isolate z-0 mb-6 h-80 overflow-hidden rounded-panel border border-line">
        <MapContainer center={located[0] ? [located[0].lat, located[0].lng] : CAMPUS} zoom={15} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {located.map((a) => (
            <CircleMarker key={a.id} center={[a.lat, a.lng]} radius={selected === a.id ? 12 : 8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: a.acknowledged_at ? '#1E7A5C' : '#E0243A', fillOpacity: 0.95 }}>
              <Popup><strong>{a.name}</strong><br />{dateTime(a.created_at)}<br /><a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">Open in Google Maps</a></Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <Segmented label="Filter alerts" className="mb-4" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: 'all', label: 'All alerts' }, { value: 'unacknowledged', label: 'Awaiting response' }]} />

      {data.items.length === 0 ? (
        <div className="panel"><EmptyState icon={Check} title={filter === 'all' ? 'No SOS alerts yet' : 'Every alert has a response'}>New alerts appear here and in the top bar as soon as a student sends one.</EmptyState></div>
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line">
            {data.items.map((a) => {
              const T = TRIGGER[a.trigger] || TRIGGER.button;
              return (
                <li key={a.id} className={`grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_1fr_auto] ${!a.acknowledged_at ? 'bg-signal/[0.04]' : ''}`} onMouseEnter={() => setSelected(a.id)}>
                  <div className="flex gap-3">
                    <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${a.acknowledged_at ? 'bg-neem' : 'animate-pulse bg-signal'}`} />
                    <div className="min-w-0">
                      <p className="font-bold">{a.name} <span className="font-normal text-muted">{a.regd_no || ''}</span></p>
                      <p className="text-sm text-muted">{[a.branch, a.batch].filter(Boolean).join(', ')}</p>
                      <p className="mt-1 text-sm"><span className="font-bold">{timeAgo(a.created_at)}</span><span className="text-muted">, {dateTime(a.created_at)}</span></p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><T.icon className="h-3.5 w-3.5" /> {T.label}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="font-bold">Sent to {a.recipients.length}</p>
                    <ul className="mt-1 space-y-0.5 text-muted">
                      {a.recipients.map((r) => <li key={r.name + r.phone}>{r.name}: {r.error ? <span className="font-bold text-signal">failed</span> : r.delivered ? 'delivered' : 'logged (no SMS gateway)'}</li>)}
                    </ul>
                    {a.acknowledged_at && <p className="mt-2 text-neem">Responded by {a.acknowledged_by_name || 'admin'} {timeAgo(a.acknowledged_at)}{a.admin_note ? `: ${a.admin_note}` : ''}</p>}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-end">
                    {a.lat !== null
                      ? <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-sm font-bold hover:border-ink/40"><ExternalLink className="h-4 w-4" /> Location{a.accuracy ? ` ±${Math.round(a.accuracy)} m` : ''}</a>
                      : <Badge tone="brass">No location</Badge>}
                    {a.phone && <a href={`tel:${a.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-sm font-bold hover:border-ink/40"><Phone className="h-4 w-4" /> {a.phone}</a>}
                    {!a.acknowledged_at && <Button size="sm" variant="danger" onClick={() => setAck(a)}><Check className="h-4 w-4" /> Mark responded</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </div>
      )}

      <Modal open={Boolean(ack)} onClose={() => setAck(null)} title={`Respond to ${ack?.name || ''}`} size="sm"
        footer={<><Button variant="ghost" onClick={() => setAck(null)}>Cancel</Button><Button loading={saving} onClick={acknowledge}>Mark responded</Button></>}>
        <p className="mb-4 text-muted">Record what action was taken. The student sees “Admin responded” on their alert.</p>
        <Textarea label="Action taken" optional placeholder="Security guard reached the location, student is safe" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Modal>
    </div>
  );
}
