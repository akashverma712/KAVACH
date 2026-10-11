import { lazy, Suspense } from 'react';
import { AlertCircle, Clock, MapPin, Mic, MicOff, Phone } from 'lucide-react';
import { Beacon } from '../components/Beacon';
import { ContactsManager } from '../components/ContactsManager';
import { Badge, Skeleton } from '../components/ui';
import { useGeo } from '../context/LocationContext';
import { useSos } from '../context/SosContext';
import { useOnline } from '../hooks/useOnline';
import { timeAgo } from '../lib/format';

const MapView = lazy(() => import('../components/MapView'));

function VoiceToggle() {
  const { voiceOn, setVoiceOn, voice } = useSos();
  if (!voice.supported) {
    return (
      <div className="flex items-start gap-3 rounded-control bg-raised p-4 text-sm">
        <MicOff className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
        <p>Voice trigger isn’t supported in this browser. Use Chrome or Edge (including Chrome on Android) to say “help” and start an SOS.</p>
      </div>
    );
  }
  return (
    <div className="rounded-control bg-raised p-4">
      <div className="flex items-center gap-3">
        <Mic className={`h-5 w-5 shrink-0 ${voiceOn && voice.listening ? 'text-signal' : 'text-muted'}`} />
        <div className="flex-1">
          <p className="font-bold">Voice trigger</p>
          <p className="text-sm text-muted">Say “help” while Kavach is open to start the countdown.</p>
        </div>
        <button type="button" role="switch" aria-checked={voiceOn} onClick={() => setVoiceOn(!voiceOn)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${voiceOn ? 'bg-signal' : 'bg-line'}`} aria-label="Voice trigger">
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${voiceOn ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      {voiceOn && (
        <p className="mt-2 pl-8 text-sm" aria-live="polite">
          {voice.error ? <span className="font-bold text-signal">{voice.error}</span>
            : voice.listening ? <span className="text-signal">Listening{voice.heard ? `: “${voice.heard.slice(-40)}”` : '…'}</span>
              : <span className="text-muted">Starting microphone…</span>}
        </p>
      )}
    </div>
  );
}

export default function Sos() {
  const { trigger, status } = useSos();
  const geo = useGeo();
  const online = useOnline();
  const limitReached = status && status.remaining === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="panel flex flex-col items-center px-4 pb-8 pt-6 text-center">
          <h1 className="text-2xl font-extrabold">Emergency SOS</h1>
          <p className="mt-1 max-w-md text-muted">Tap once. You’ll have 10 seconds to cancel before your location is sent.</p>
          <div className="my-2">
            <Beacon size={200} onPress={() => trigger('button')} disabled={Boolean(limitReached)} sub={limitReached ? 'Limit reached' : 'Tap for help'} />
          </div>
          {status ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Clock className="h-4 w-4" />
              {limitReached
                ? `Hourly limit reached. Available again ${status.resets_at ? timeAgo(status.resets_at) : 'soon'}.`
                : `${status.remaining} of ${status.max} alerts available this hour`}
            </p>
          ) : <Skeleton className="h-4 w-48" />}
          {limitReached && (
            <a href="tel:112" className="mt-4 inline-flex h-12 items-center gap-2 rounded-control bg-signal px-6 font-bold text-white"><Phone className="h-5 w-5" /> Call 112</a>
          )}
          {!online && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-brass"><AlertCircle className="h-4 w-4" /> You’re offline. SOS will open your SMS app with your location.</p>}
        </section>

        <section className="panel p-4" aria-labelledby="map-title">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 id="map-title" className="flex items-center gap-2 font-bold"><MapPin className="h-5 w-5 text-signal" /> Your location</h2>
            {geo.status === 'ok' && geo.coords
              ? <Badge tone="neem" dot>±{Math.round(geo.coords.accuracy)} m</Badge>
              : geo.status === 'denied'
                ? <Badge tone="signal">Blocked</Badge>
                : <Badge tone="brass">Locating</Badge>}
          </div>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <MapView coords={geo.coords} className="h-72" />
          </Suspense>
          {geo.status === 'denied' && (
            <p className="mt-3 px-1 text-sm text-muted">
              Location permission is blocked. Allow location for this site in your browser settings so SOS can include a map link. <button type="button" onClick={geo.retry} className="font-bold text-ink underline">Try again</button>
            </p>
          )}
          {geo.coords && (
            <p className="mt-3 px-1 text-sm text-muted">
              {geo.coords.lat.toFixed(5)}, {geo.coords.lng.toFixed(5)}{' '}
              <a href={`https://www.google.com/maps?q=${geo.coords.lat},${geo.coords.lng}`} target="_blank" rel="noreferrer" className="font-bold text-ink underline">Open in Google Maps</a>
            </p>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="panel p-5" aria-labelledby="contacts-title">
          <h2 id="contacts-title" className="text-lg font-bold">Emergency contacts</h2>
          <p className="text-sm text-muted">Everyone here gets an SMS with your location.</p>
          <div className="mt-2"><ContactsManager compact /></div>
        </section>
        <VoiceToggle />
        {status?.recent?.length > 0 && (
          <section className="panel p-5" aria-labelledby="history-title">
            <h2 id="history-title" className="font-bold">Recent alerts</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {status.recent.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="block font-bold">{timeAgo(e.created_at)}</span>
                    <span className="text-muted">{e.trigger === 'voice' ? 'Voice' : e.trigger === 'offline_sync' ? 'Sent after reconnecting' : 'Button'}, {e.recipients.length} recipients</span>
                  </span>
                  {e.acknowledged_at ? <Badge tone="neem">Admin responded</Badge> : <Badge tone={e.status === 'failed' ? 'signal' : 'muted'}>{e.status === 'failed' ? 'Failed' : 'Sent'}</Badge>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
