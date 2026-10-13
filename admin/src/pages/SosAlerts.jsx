import { useCallback, useEffect, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Mic,
  MousePointerClick,
  Navigation,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { PageHeader, Pagination } from '../components/kit';
import { Badge, Button, EmptyState, Modal, PageLoader, Segmented, Textarea } from '../components/ui';
import { useSosAlert } from '../context/SosAlertContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { dateTime, timeAgo } from '../lib/format';

const CAMPUS_CENTER = [23.6524, 86.4897];

const TRIGGER_META = {
  button: { label: 'Button', icon: MousePointerClick, tone: 'muted' },
  voice: { label: 'Voice “help”', icon: Mic, tone: 'signal' },
  offline_sync: { label: 'Sent after reconnecting', icon: WifiOff, tone: 'brass' },
};

export default function SosAlerts() {
  const toast = useToast();
  const { setModalAlert, activeAlerts } = useSosAlert();

  const [filter, setFilter] = useState('all'); // all | unacknowledged | active | resolved
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [trail, setTrail] = useState([]);
  const [loadingTrail, setLoadingTrail] = useState(false);

  // Acknowledge & resolve modal states
  const [ackTarget, setAckTarget] = useState(null);
  const [ackNote, setAckNote] = useState('');
  const [savingAck, setSavingAck] = useState(false);

  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);

  const load = useCallback(() => {
    return api(`/admin/sos?filter=${filter}&page=${page}`)
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, [filter, page, toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  // When active alerts change in context, refresh list
  useEffect(() => {
    if (activeAlerts) load();
  }, [activeAlerts, load]);

  // Load location trail for selected alert
  const loadTrailFor = useCallback(
    async (id) => {
      setLoadingTrail(true);
      try {
        const detail = await api(`/admin/sos/${id}`);
        setTrail(detail?.trail || []);
      } catch {
        setTrail([]);
      } finally {
        setLoadingTrail(false);
      }
    },
    [],
  );

  const handleSelectAlert = (alert) => {
    setSelected(alert);
    if (alert.id) {
      loadTrailFor(alert.id);
    }
  };

  const handleAcknowledge = async () => {
    if (!ackTarget) return;
    setSavingAck(true);
    try {
      await api(`/admin/sos/${ackTarget.id}/acknowledge`, {
        method: 'POST',
        body: ackNote.trim() ? { note: ackNote.trim() } : {},
      });
      toast.success('Marked as responded');
      setAckTarget(null);
      setAckNote('');
      load();
      window.dispatchEvent(new Event('kavach-refresh-counts'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingAck(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setSavingResolve(true);
    try {
      await api(`/admin/sos/${resolveTarget.id}/resolve`, {
        method: 'POST',
        body: resolveNote.trim() ? { note: resolveNote.trim() } : {},
      });
      toast.success('Alert resolved and closed');
      setResolveTarget(null);
      setResolveNote('');
      load();
      window.dispatchEvent(new Event('kavach-refresh-counts'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingResolve(false);
    }
  };

  if (!data) return <PageLoader />;

  const locatedAlerts = data.items.filter((a) => {
    const lat = a.last_lat ?? a.lat;
    const lng = a.last_lng ?? a.lng;
    return Number.isFinite(lat) && Number.isFinite(lng);
  });

  const selectedLat = selected?.last_lat ?? selected?.lat;
  const selectedLng = selected?.last_lng ?? selected?.lng;

  const mapCenter = Number.isFinite(selectedLat) && Number.isFinite(selectedLng)
    ? [selectedLat, selectedLng]
    : locatedAlerts[0]
    ? [locatedAlerts[0].last_lat ?? locatedAlerts[0].lat, locatedAlerts[0].last_lng ?? locatedAlerts[0].lng]
    : CAMPUS_CENTER;

  const trailCoordinates = trail
    .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
    .map((pt) => [pt.lat, pt.lng]);

  return (
    <div>
      <PageHeader
        title="SOS alerts"
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      >
        Every alert students send with real-time SSE updates, location trail, and immediate action response.
      </PageHeader>

      {/* Map Section with Location Trail */}
      <div className="relative isolate z-0 mb-6 h-96 overflow-hidden rounded-panel border border-line shadow-sm">
        <MapContainer center={mapCenter} zoom={15} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Location Trail Polyline for selected alert */}
          {trailCoordinates.length > 1 && (
            <Polyline
              positions={trailCoordinates}
              pathOptions={{ color: '#E0243A', weight: 4, dashArray: '6, 8', opacity: 0.8 }}
            />
          )}

          {/* Historical location breadcrumbs on trail */}
          {trail.slice(0, -1).map((pt, i) => (
            <CircleMarker
              key={pt.created_at + i}
              center={[pt.lat, pt.lng]}
              radius={4}
              pathOptions={{ color: '#E0243A', fillColor: '#fff', fillOpacity: 0.8, weight: 1.5 }}
            >
              <Popup>
                <span className="text-xs font-mono">{dateTime(pt.created_at)}</span>
              </Popup>
            </CircleMarker>
          ))}

          {/* Markers for all located alerts */}
          {locatedAlerts.map((a) => {
            const aLat = a.last_lat ?? a.lat;
            const aLng = a.last_lng ?? a.lng;
            const isSel = selected?.id === a.id;
            const isAck = Boolean(a.acknowledged_at);
            const isRes = Boolean(a.resolved_at);

            const fillColor = isRes ? '#107C41' : isAck ? '#D97706' : '#E0243A';

            return (
              <CircleMarker
                key={a.id}
                center={[aLat, aLng]}
                radius={isSel ? 14 : 9}
                pathOptions={{
                  color: '#fff',
                  weight: isSel ? 3 : 2,
                  fillColor,
                  fillOpacity: 0.95,
                }}
                eventHandlers={{
                  click: () => handleSelectAlert(a),
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>{a.name}</strong> ({a.regd_no || ''})
                    <br />
                    {a.resolved_at ? 'Resolved' : a.acknowledged_at ? 'Admin Responding' : 'Awaiting Response'}
                    <br />
                    {dateTime(a.created_at)}
                    <br />
                    <button
                      type="button"
                      onClick={() => setModalAlert(a)}
                      className="mt-1 font-bold text-signal underline"
                    >
                      Open Alert Alarm
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {trailCoordinates.length > 1 && (
          <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-control bg-surface/90 px-3 py-1.5 text-xs font-bold shadow backdrop-blur">
            <Navigation className="h-3.5 w-3.5 text-signal" />
            <span>Showing trail ({trailCoordinates.length} points) for {selected?.name}</span>
          </div>
        )}
      </div>

      {/* Segmented Filter */}
      <Segmented
        label="Filter alerts"
        className="mb-4"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={[
          { value: 'all', label: 'All alerts' },
          { value: 'unacknowledged', label: 'Awaiting response' },
          { value: 'active', label: 'Active live' },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />

      {data.items.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Check}
            title={
              filter === 'all'
                ? 'No SOS alerts yet'
                : filter === 'unacknowledged'
                ? 'Every alert has a response'
                : filter === 'active'
                ? 'No active alerts in progress'
                : 'No resolved alerts'
            }
          >
            New alerts appear here and trigger the full-screen alarm the moment a student sends one.
          </EmptyState>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line">
            {data.items.map((a) => {
              const T = TRIGGER_META[a.trigger] || TRIGGER_META.button;
              const isUnack = !a.acknowledged_at && !a.resolved_at;
              const isSelected = selected?.id === a.id;
              const curLat = a.last_lat ?? a.lat;
              const curLng = a.last_lng ?? a.lng;
              const curAcc = a.last_accuracy ?? a.accuracy;
              const hasCoord = Number.isFinite(curLat) && Number.isFinite(curLng);

              return (
                <li
                  key={a.id}
                  onClick={() => handleSelectAlert(a)}
                  className={`grid gap-4 px-5 py-4 cursor-pointer transition-colors md:grid-cols-[1.2fr_1fr_auto] ${
                    isUnack
                      ? 'bg-signal/[0.06] hover:bg-signal/[0.1]'
                      : isSelected
                      ? 'bg-raised/70'
                      : 'hover:bg-raised/40'
                  }`}
                >
                  {/* Left Column: Student info and triggers */}
                  <div className="flex gap-3 min-w-0">
                    <span
                      className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${
                        a.resolved_at
                          ? 'bg-neem'
                          : a.acknowledged_at
                          ? 'bg-brass'
                          : 'animate-pulse bg-signal ring-4 ring-signal/20'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-base">{a.name}</p>
                        {a.regd_no && <span className="text-xs font-semibold text-muted">({a.regd_no})</span>}
                        {isUnack && <Badge tone="signal">URGENT</Badge>}
                        {a.resolved_at && <Badge tone="neem">Safe</Badge>}
                      </div>
                      <p className="text-xs text-muted">
                        {[a.branch, a.batch].filter(Boolean).join(', ') || 'Student'}
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="font-bold">{timeAgo(a.created_at)}</span>
                        <span className="text-muted">, {dateTime(a.created_at)}</span>
                      </p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                        <span className="flex items-center gap-1 font-semibold text-muted">
                          <T.icon className="h-3.5 w-3.5" /> {T.label}
                        </span>
                        {a.location_count > 1 && (
                          <span className="rounded bg-line px-1.5 py-0.5 text-[11px] font-mono">
                            {a.location_count} location updates
                          </span>
                        )}
                      </div>

                      {/* Transcript if voice */}
                      {a.transcript && (
                        <p className="mt-2 rounded bg-signal/10 px-2 py-1 text-xs font-mono text-signal">
                          Heard: “{a.transcript}”
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Recipients & status */}
                  <div className="text-xs space-y-1.5">
                    <p className="font-bold">Notified {a.recipients?.length || 0} Contacts:</p>
                    <ul className="space-y-0.5 text-muted max-h-20 overflow-y-auto">
                      {(a.recipients || []).map((r, i) => (
                        <li key={r.phone + i} className="truncate">
                          {r.name}:{' '}
                          {r.error ? (
                            <span className="font-bold text-signal">failed</span>
                          ) : r.delivered ? (
                            <span className="text-neem">delivered</span>
                          ) : (
                            <span>logged</span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {a.acknowledged_at && (
                      <p className="pt-1 text-xs text-brass font-medium">
                        Responded by {a.acknowledged_by_name || 'Admin'} {timeAgo(a.acknowledged_at)}
                        {a.admin_note ? `: “${a.admin_note}”` : ''}
                      </p>
                    )}
                    {a.resolved_at && (
                      <p className="text-xs text-neem font-medium">
                        Resolved {timeAgo(a.resolved_at)} by {a.resolved_by || 'student'}
                        {a.resolution_note ? `: “${a.resolution_note}”` : ''}
                      </p>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div
                    className="flex flex-wrap items-start gap-2 md:flex-col md:items-end justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasCoord ? (
                      <a
                        href={`https://www.google.com/maps?q=${curLat},${curLng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-2.5 text-xs font-bold hover:border-ink/40"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Map{curAcc ? ` ±${Math.round(curAcc)}m` : ''}
                      </a>
                    ) : (
                      <Badge tone="brass">No GPS</Badge>
                    )}

                    {a.phone && (
                      <a
                        href={`tel:${a.phone}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-2.5 text-xs font-bold hover:border-ink/40"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModalAlert(a)}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 text-signal" /> Alarm view
                    </Button>

                    {!a.acknowledged_at && !a.resolved_at && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setAckTarget(a)}
                      >
                        <Check className="h-3.5 w-3.5" /> Respond
                      </Button>
                    )}

                    {!a.resolved_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResolveTarget(a)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-neem" /> Resolve
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </div>
      )}

      {/* Acknowledge Response Modal */}
      <Modal
        open={Boolean(ackTarget)}
        onClose={() => setAckTarget(null)}
        title={`Respond to ${ackTarget?.name || 'Student'}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAckTarget(null)}>
              Cancel
            </Button>
            <Button loading={savingAck} onClick={handleAcknowledge}>
              Mark responded
            </Button>
          </>
        }
      >
        <p className="mb-4 text-xs text-muted">
          Record what action is being taken. The student’s app screen will immediately display this note.
        </p>
        <Textarea
          label="Action taken"
          optional
          placeholder="Security guard has reached the library, student is safe"
          value={ackNote}
          onChange={(e) => setAckNote(e.target.value)}
          maxLength={500}
        />
      </Modal>

      {/* Resolve Alert Modal */}
      <Modal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title={`Resolve and close SOS for ${resolveTarget?.name || 'Student'}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button loading={savingResolve} onClick={handleResolve}>
              Close alert
            </Button>
          </>
        }
      >
        <p className="mb-4 text-xs text-muted">
          Confirm that the emergency has been resolved. This closes the alert and removes it from active alarms.
        </p>
        <Textarea
          label="Resolution note"
          optional
          placeholder="Student escorted to hostel room, incident logged"
          value={resolveNote}
          onChange={(e) => setResolveNote(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </div>
  );
}
