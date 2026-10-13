import { useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import {
  AlertOctagon,
  Check,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Mic,
  MousePointerClick,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { useSosAlert } from '../context/SosAlertContext';
import { dateTime, timeAgo } from '../lib/format';

const CAMPUS_DEFAULT = [23.6524, 86.4897];

export function SosAlertModal() {
  const {
    modalAlert,
    setModalAlert,
    acknowledgeAlert,
    resolveAlert,
    isSirenActive,
    muteSiren,
  } = useSosAlert();

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [resolveNote, setResolveNote] = useState('');

  if (!modalAlert) return null;

  const lat = modalAlert.last_lat ?? modalAlert.lat;
  const lng = modalAlert.last_lng ?? modalAlert.lng;
  const accuracy = modalAlert.last_accuracy ?? modalAlert.accuracy;
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
  const isAck = Boolean(modalAlert.acknowledged_at);
  const isResolved = Boolean(modalAlert.resolved_at);

  const handleAcknowledge = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await acknowledgeAlert(modalAlert.id, note.trim());
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await resolveAlert(modalAlert.id, resolveNote.trim());
      setShowResolveInput(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-night/85 p-4 backdrop-blur-md animate-fade-in"
    >
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-panel border-2 border-signal bg-surface shadow-2xl">
        {/* Urgent Alert Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-signal px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 animate-pulse">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold tracking-wide uppercase flex items-center gap-2">
                EMERGENCY SOS ALERT
                {!isAck && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-signal uppercase">Awaiting Action</span>}
              </h2>
              <p className="text-xs text-white/90">
                Triggered {timeAgo(modalAlert.created_at)} ({dateTime(modalAlert.created_at)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSirenActive() && (
              <button
                type="button"
                onClick={muteSiren}
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 transition-colors"
              >
                <VolumeX className="h-4 w-4" /> Mute siren
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalAlert(null)}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/20 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Left Column: Student Details, Spoken Words, Actions */}
          <div className="space-y-5">
            {/* Student info box */}
            <div className="rounded-control border border-line bg-raised p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-extrabold">{modalAlert.name}</h3>
                  <p className="text-sm font-semibold text-muted">
                    {modalAlert.regd_no ? `Regd: ${modalAlert.regd_no}` : ''}
                    {modalAlert.branch ? ` • ${modalAlert.branch}` : ''}
                    {modalAlert.batch ? ` • ${modalAlert.batch}` : ''}
                  </p>
                </div>
                {modalAlert.phone && (
                  <a
                    href={`tel:${modalAlert.phone}`}
                    className="flex h-10 items-center gap-2 rounded-control bg-signal px-3.5 text-sm font-extrabold text-white shadow hover:bg-signal/90 active:scale-95 transition-all"
                  >
                    <Phone className="h-4 w-4" /> Call Student
                  </a>
                )}
              </div>

              {/* Trigger Info & Spoken Words */}
              <div className="mt-3 border-t border-line/60 pt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-muted">
                  {modalAlert.trigger === 'voice' ? (
                    <span className="flex items-center gap-1 text-signal font-bold">
                      <Mic className="h-3.5 w-3.5" /> Voice-Activated SOS
                    </span>
                  ) : modalAlert.trigger === 'offline_sync' ? (
                    <span className="flex items-center gap-1 text-brass font-bold">
                      <WifiOff className="h-3.5 w-3.5" /> Triggered Offline & Synced
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold">
                      <MousePointerClick className="h-3.5 w-3.5" /> Button Triggered
                    </span>
                  )}
                </div>

                {modalAlert.transcript && (
                  <div className="rounded-control bg-signal/10 border border-signal/30 p-2.5 text-xs text-ink">
                    <span className="font-bold text-signal flex items-center gap-1 mb-0.5">
                      <Mic className="h-3.5 w-3.5" /> Words Heard by Microphone:
                    </span>
                    <span className="font-mono text-sm font-extrabold">
                      “{modalAlert.transcript}”
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Response Section */}
            {isResolved ? (
              <div className="rounded-control bg-neem/15 border border-neem/40 p-4 text-sm text-neem">
                <p className="font-extrabold flex items-center gap-1.5">
                  <ShieldCheck className="h-5 w-5" /> Alert Resolved
                </p>
                <p className="mt-1 text-ink/90 text-xs">
                  Closed by {modalAlert.resolved_by || 'admin'} at {dateTime(modalAlert.resolved_at)}
                  {modalAlert.resolution_note ? `: "${modalAlert.resolution_note}"` : ''}
                </p>
              </div>
            ) : isAck ? (
              <div className="space-y-3 rounded-control border border-neem/40 bg-neem/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-neem flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Responded by {modalAlert.acknowledged_by_name || 'Admin'}
                  </p>
                  <span className="text-xs text-muted">{timeAgo(modalAlert.acknowledged_at)}</span>
                </div>
                {modalAlert.admin_note && (
                  <p className="rounded bg-surface p-2.5 text-xs font-mono text-ink border border-line">
                    “{modalAlert.admin_note}”
                  </p>
                )}

                {showResolveInput ? (
                  <form onSubmit={handleResolve} className="space-y-2 pt-2 border-t border-line/60">
                    <input
                      type="text"
                      placeholder="Resolution note (e.g. Student safe in hostel)"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      maxLength={300}
                      className="w-full rounded-control border border-line bg-surface px-3 py-2 text-xs focus:ring-2 focus:ring-neem focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 rounded-control bg-neem py-2 text-xs font-bold text-white hover:bg-neem/90"
                      >
                        {submitting ? 'Closing…' : 'Confirm Close Alert'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResolveInput(false)}
                        className="rounded-control border border-line px-3 py-2 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowResolveInput(true)}
                    className="w-full rounded-control bg-ink py-2 text-xs font-bold text-bg hover:opacity-90 transition-opacity"
                  >
                    Close / Resolve Alert
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleAcknowledge} className="space-y-3 rounded-control border border-signal/30 bg-signal/5 p-4">
                <h4 className="font-bold text-sm text-signal flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4" /> Immediate Campus Action:
                </h4>
                <p className="text-xs text-muted">
                  Let the student know help is on the way. The student’s app screen will immediately display this note.
                </p>
                <input
                  type="text"
                  placeholder="e.g. Security guard has been dispatched to your location"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={400}
                  className="w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-signal focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-signal text-sm font-extrabold text-white shadow hover:bg-signal/90 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {submitting ? 'Notifying student…' : "I'm Responding (Send Note)"}
                </button>
              </form>
            )}

            {/* Contacts SMS delivery table */}
            <div className="rounded-control border border-line bg-raised p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                SMS Delivery Status ({modalAlert.recipients?.length || 0})
              </h4>
              <ul className="divide-y divide-line/60 text-xs max-h-32 overflow-y-auto">
                {(modalAlert.recipients || []).map((r, i) => (
                  <li key={r.phone + i} className="flex items-center justify-between py-1.5">
                    <span className="font-medium truncate">
                      {r.name} <span className="text-muted">({r.phone})</span>
                    </span>
                    <span
                      className={`font-bold ${
                        r.error ? 'text-signal' : r.delivered ? 'text-neem' : 'text-muted'
                      }`}
                    >
                      {r.error ? 'Failed' : r.delivered ? 'Delivered' : r.via || 'Logged'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Live Location Map */}
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-signal" /> Live Location
              </h4>
              {hasLoc && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-ink underline hover:text-signal"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Google Maps
                </a>
              )}
            </div>

            <div className="relative isolate z-0 h-80 w-full overflow-hidden rounded-control border border-line shadow-inner">
              {hasLoc ? (
                <MapContainer
                  center={[lat, lng]}
                  zoom={16}
                  className="h-full w-full"
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {accuracy && (
                    <Circle
                      center={[lat, lng]}
                      radius={accuracy}
                      pathOptions={{ color: '#E0243A', fillColor: '#E0243A', fillOpacity: 0.15, weight: 1 }}
                    />
                  )}
                  <CircleMarker
                    center={[lat, lng]}
                    radius={10}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: '#E0243A', fillOpacity: 0.95 }}
                  >
                    <Popup>
                      <strong>{modalAlert.name}</strong>
                      <br />
                      Accuracy: ~{accuracy ? Math.round(accuracy) : '?'} m
                    </Popup>
                  </CircleMarker>
                </MapContainer>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-raised p-4 text-center text-muted">
                  <MapPin className="h-8 w-8 text-muted mb-2" />
                  <p className="font-bold">GPS Location Unavailable</p>
                  <p className="text-xs mt-1">Student's device GPS was turned off or blocked.</p>
                </div>
              )}
            </div>

            {hasLoc && (
              <p className="text-xs text-muted flex items-center justify-between">
                <span>Coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
                <span>Accuracy: ±{accuracy ? Math.round(accuracy) : '?'} m</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
