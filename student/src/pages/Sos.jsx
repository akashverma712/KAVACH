import { lazy, Suspense } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Siren,
  Crosshair,
} from 'lucide-react';
import { Beacon } from '../components/Beacon';
import { ContactsManager } from '../components/ContactsManager';
import { Badge, Skeleton } from '../components/ui';
import { VoiceGuardPanel } from '../components/VoiceGuardPanel';
import { useGeo } from '../context/LocationContext';
import { useSos } from '../context/SosContext';
import { useOnline } from '../hooks/useOnline';
import { dateTime, timeAgo } from '../lib/format';

const MapView = lazy(() => import('../components/MapView'));

export default function Sos() {
  const { trigger, status, activeSos, markSafe, reopenOverlay } = useSos();
  const geo = useGeo();
  const online = useOnline();
  const limitReached = status && status.remaining === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* Active Alert Banner if emergency is live */}
        {activeSos && (
          <section className="rounded-panel border-2 border-signal/50 bg-[#6E2638]/20 p-5 shadow-sm animate-rise">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-signal/25 text-signal animate-pulse border border-signal/40">
                  <Siren className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-display font-black text-signal flex items-center gap-2">
                    ACTIVE SOS DISPATCH
                    <Badge tone="signal" dot>Live Broadcast</Badge>
                  </h2>
                  <p className="text-xs text-muted">
                    Triggered {timeAgo(activeSos.created_at)} ({dateTime(activeSos.created_at)})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={reopenOverlay}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-black uppercase tracking-wider hover:bg-raised text-ink"
                >
                  View Overlay
                </button>
                <button
                  type="button"
                  onClick={() => markSafe()}
                  className="flex items-center gap-1.5 rounded-control bg-neem px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-neem/90 active:scale-95 transition-all dark:text-night"
                >
                  <ShieldCheck className="h-4 w-4" />
                  I'm Safe Now
                </button>
              </div>
            </div>

            {activeSos.acknowledged_at && (
              <div className="mt-4 rounded-control border border-neem/30 bg-neem/10 p-3 text-xs font-bold text-neem">
                <p className="flex items-center gap-1.5 font-black uppercase tracking-wide">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Campus Security Desk is Responding
                </p>
                <p className="mt-1 text-ink/90 font-normal">
                  {activeSos.admin_note || 'Campus security has received your GPS alert and dispatched personnel.'}
                </p>
              </div>
            )}
          </section>
        )}

        {/* SOS Central Dispatch Beacon Section */}
        <section className="panel flex flex-col items-center px-4 pb-8 pt-7 text-center">
          <span className="text-[11px] font-black uppercase tracking-widest text-signal">
            CRITICAL SYSTEM
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-ink">
            Emergency SOS Beacon
          </h1>
          <p className="mt-1 max-w-md text-xs sm:text-sm text-muted">
            Tap once. A 10-second window gives you time to cancel before automated SMS dispatch.
          </p>

          <div className="my-4">
            <Beacon
              size={210}
              onPress={() => trigger('button')}
              disabled={Boolean(limitReached)}
              sub={limitReached ? 'Limit reached' : 'Tap for help'}
            />
          </div>

          {status ? (
            <p className="flex items-center gap-2 text-xs font-bold text-muted">
              <Clock className="h-3.5 w-3.5 text-glacial" />
              {limitReached
                ? `Hourly limit reached. Available again ${status.resets_at ? timeAgo(status.resets_at) : 'soon'}.`
                : `${status.remaining} of ${status.max} alerts available this rolling hour`}
            </p>
          ) : (
            <Skeleton className="h-4 w-48" />
          )}

          {limitReached && (
            <a
              href="tel:112"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-control bg-signal px-6 text-xs font-black uppercase tracking-wider text-white shadow-sos hover:bg-signal/90"
            >
              <Phone className="h-4 w-4" /> Call 112 Directly
            </a>
          )}

          {!online && (
            <p className="mt-3.5 flex items-center gap-2 rounded-control bg-brass/10 border border-brass/30 px-3 py-1.5 text-xs font-bold text-brass">
              <AlertCircle className="h-4 w-4 shrink-0" /> Device is offline. Beacon will launch native SMS with coordinates.
            </p>
          )}
        </section>

        {/* Tactical GPS Map Section */}
        <section className="panel p-5" aria-labelledby="map-title">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-control bg-glacial/15 text-glacial">
                <Crosshair className="h-4 w-4" />
              </span>
              <h2 id="map-title" className="font-display text-base font-black text-ink">
                Live GPS Position
              </h2>
            </div>

            {geo.status === 'ok' && geo.coords ? (
              <Badge tone="neem" dot>
                Accurate to ±{Math.round(geo.coords.accuracy)}m
              </Badge>
            ) : geo.status === 'denied' ? (
              <Badge tone="signal">Permission Blocked</Badge>
            ) : (
              <Badge tone="brass">Acquiring Fix</Badge>
            )}
          </div>

          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <MapView coords={geo.coords} className="h-72 rounded-control" />
          </Suspense>

          {geo.status === 'denied' && (
            <p className="mt-3 text-xs text-muted">
              Location permissions are currently blocked in your browser. Allow location to ensure emergency SMS messages contain map links.{' '}
              <button
                type="button"
                onClick={geo.retry}
                className="font-black text-glacial underline uppercase"
              >
                Retry Permission
              </button>
            </p>
          )}

          {geo.coords && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted border-t border-line/60 pt-2.5">
              <span className="font-mono text-ink">
                {geo.coords.lat.toFixed(5)}° N, {geo.coords.lng.toFixed(5)}° E
              </span>
              <a
                href={`https://www.google.com/maps?q=${geo.coords.lat},${geo.coords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="font-black text-glacial hover:underline uppercase tracking-wider"
              >
                Open in Google Maps →
              </a>
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        {/* Trusted Emergency Contacts */}
        <section className="panel p-5" aria-labelledby="contacts-title">
          <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
            RECIPIENTS
          </span>
          <h2 id="contacts-title" className="font-display text-lg font-black text-ink">
            Emergency Contacts
          </h2>
          <p className="text-xs text-muted">
            Contacts who receive automatic SMS updates and Google Maps links when you trigger SOS.
          </p>
          <div className="mt-3">
            <ContactsManager compact />
          </div>
        </section>

        {/* VoiceGuard Engine Panel */}
        <VoiceGuardPanel />

        {/* Recent Dispatch History */}
        {status?.recent?.length > 0 && (
          <section className="panel p-5" aria-labelledby="history-title">
            <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
              AUDIT LOG
            </span>
            <h2 id="history-title" className="font-display text-base font-black text-ink">
              Recent Dispatches
            </h2>
            <ul className="mt-3 divide-y divide-line/60 text-xs">
              {status.recent.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <span className="block font-black text-ink truncate">
                      {timeAgo(e.created_at)}
                    </span>
                    <span className="text-muted text-[11px]">
                      {e.trigger === 'voice'
                        ? '🎙 Voice Trigger'
                        : e.trigger === 'offline_sync'
                        ? '⚡ Offline Sync'
                        : '🔘 Button Beacon'}
                      {' · '}{e.recipients?.length || 0} notified
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {e.resolved_at ? (
                      <Badge tone="neem">Safe</Badge>
                    ) : e.acknowledged_at ? (
                      <Badge tone="brass">Responded</Badge>
                    ) : (
                      <Badge tone={e.status === 'failed' ? 'signal' : 'muted'}>
                        {e.status === 'failed' ? 'Failed' : 'Dispatched'}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
