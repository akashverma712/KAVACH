import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HandCoins, MapPin, MessagesSquare, Phone, UserPlus, Users, ShieldAlert } from 'lucide-react';
import { Beacon } from '../components/Beacon';
import { Badge, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useGeo } from '../context/LocationContext';
import { useSos } from '../context/SosContext';
import { api } from '../lib/api';
import { SEVERITY, STATUS, timeAgo, rupees } from '../lib/format';

const MOODS = [
  { v: 4, emoji: '😄', label: 'Great' },
  { v: 3, emoji: '🙂', label: 'Good' },
  { v: 2, emoji: '😕', label: 'Low' },
  { v: 1, emoji: '😣', label: 'Struggling' },
];
const MOOD_KEY = 'kavach-mood-log';
const today = () => new Date().toISOString().slice(0, 10);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function WellbeingCheckIn() {
  const [log, setLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(MOOD_KEY) || '{}');
    } catch {
      return {};
    }
  });

  const mood = log[today()];

  const pick = (v) => {
    const next = { ...log, [today()]: v };
    const keep = Object.keys(next).sort().slice(-30);
    const trimmed = Object.fromEntries(keep.map((k) => [k, next[k]]));
    setLog(trimmed);
    localStorage.setItem(MOOD_KEY, JSON.stringify(trimmed));
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = d.toISOString().slice(0, 10);
    return { k, v: log[k], day: d.toLocaleDateString('en-IN', { weekday: 'narrow' }) };
  });

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="checkin-title">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-glacial">
            DAILY PULSE
          </span>
          <h2 id="checkin-title" className="font-display text-lg font-bold text-ink">
            How are you feeling today?
          </h2>
          <p className="text-xs text-muted">
            100% confidential to your device. No telemetry or server storage.
          </p>
        </div>

        {/* Stepped pixel history trail (Hacktoberfest pixel style) */}
        <div className="flex items-end gap-1.5 self-start sm:self-auto" aria-label="Last 7 days mood history">
          {week.map((d) => (
            <div key={d.k} className="flex flex-col items-center gap-1">
              <span
                className={`w-3.5 rounded-[3px] transition-all ${
                  d.v
                    ? d.v >= 3
                      ? 'bg-neem'
                      : d.v === 2
                      ? 'bg-brass'
                      : 'bg-signal'
                    : 'bg-line/70'
                }`}
                style={{ height: d.v ? 10 + d.v * 6 : 10 }}
              />
              <span className="text-[10px] font-bold uppercase text-muted">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Mood options">
        {MOODS.map((m) => {
          const active = mood === m.v;
          return (
            <button
              key={m.v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(m.v)}
              className={`flex flex-col items-center gap-1 rounded-control border py-3 text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                active
                  ? 'border-ink bg-ink text-bg shadow-sm'
                  : 'border-line bg-surface hover:border-glacial/60 hover:bg-raised text-ink'
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {m.emoji}
              </span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {mood && mood <= 2 && (
        <div className="mt-5 rounded-control border border-brass/30 bg-brass/10 p-4 animate-rise">
          <p className="font-bold text-sm text-ink">
            Thank you for checking in. Heavy days happen, and you never have to carry them alone.
          </p>
          <p className="mt-1 text-xs text-muted">
            Tele-MANAS offers free, confidential student counselling anytime in Hindi, English, and regional languages.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <a
              href="tel:14416"
              className="inline-flex h-9 items-center gap-2 rounded-control bg-neem px-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm dark:text-night"
            >
              <Phone className="h-3.5 w-3.5" /> Call Tele-MANAS (14416)
            </a>
            <Link
              to="/app/chat"
              className="inline-flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-xs font-bold text-ink shadow-sm hover:border-glacial"
            >
              <MessagesSquare className="h-3.5 w-3.5" /> Talk to Campus Assistant
            </Link>
          </div>
        </div>
      )}

      {mood && mood >= 3 && (
        <p className="mt-3.5 text-xs font-bold text-neem">
          ✓ Logged. Glad to see you're feeling good today!
        </p>
      )}
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const geo = useGeo();
  const { trigger, status, contacts } = useSos();
  const [posts, setPosts] = useState(null);
  const [funds, setFunds] = useState(null);

  useEffect(() => {
    api('/posts?sort=severity&status=active&limit=3')
      .then((d) => setPosts(d.items))
      .catch(() => setPosts([]));
    api('/fundraisers?limit=2')
      .then((d) => setFunds(d.items))
      .catch(() => setFunds([]));
  }, []);

  const personal = contacts?.contacts?.length ?? null;
  const locText = {
    ok: geo.coords
      ? `GPS Active (±${Math.round(geo.coords.accuracy)}m accuracy)`
      : 'GPS Active',
    locating: 'Acquiring GPS fix…',
    denied: 'Location blocked in browser. SOS will omit map link.',
    unavailable: 'GPS unavailable on this device right now',
    unsupported: 'Browser does not support geolocation',
    idle: 'Standby for GPS…',
  }[geo.status];

  return (
    <div className="space-y-6">
      {/* Personalized Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-glacial">
            COMMAND CENTER
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-ink">
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-muted mt-0.5">
            {[user?.branch, user?.batch].filter(Boolean).join(' · ') || 'BIT Sindri Student'}
          </p>
        </div>

        {status && (
          <div className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted self-start sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-neem animate-pulse" />
            <span className="font-mono text-ink font-extrabold">{status.remaining}</span>/{status.max} alerts ready this hour
          </div>
        )}
      </div>

      {/* Emergency SOS Centerpiece Card */}
      <section className="panel overflow-hidden border-signal/30 bg-gradient-to-br from-surface via-surface to-signal/5">
        <div className="grid items-center gap-4 md:grid-cols-[auto_1fr] p-2">
          <div className="flex justify-center p-4">
            <Beacon size={155} sub="Tap for SOS" onPress={() => trigger('button')} />
          </div>

          <div className="px-5 pb-6 pt-2 md:py-6 md:pr-8">
            <div className="flex items-center gap-2">
              <span className="rounded-tag bg-signal px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                INSTANT BEACON
              </span>
              <h2 className="font-display text-xl font-black text-ink">
                Emergency Dispatch
              </h2>
            </div>

            <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed">
              Tap the beacon disc. A 10-second audible countdown allows cancellation. If confirmed, your live GPS coordinates are dispatched to your emergency network.
            </p>

            <ul className="mt-4 space-y-2.5 text-xs font-bold text-ink">
              <li className="flex items-center gap-2.5 rounded-control border border-line/60 bg-raised/50 p-2">
                <MapPin
                  className={`h-4 w-4 shrink-0 ${
                    geo.status === 'ok' ? 'text-neem' : 'text-brass'
                  }`}
                />
                <span className="flex-1 truncate">{locText}</span>
                {(geo.status === 'denied' || geo.status === 'unavailable') && (
                  <button
                    type="button"
                    onClick={geo.retry}
                    className="font-black text-glacial underline uppercase"
                  >
                    Retry
                  </button>
                )}
              </li>

              <li className="flex items-center gap-2.5 rounded-control border border-line/60 bg-raised/50 p-2">
                <UserPlus
                  className={`h-4 w-4 shrink-0 ${
                    personal ? 'text-neem' : 'text-brass'
                  }`}
                />
                <span className="flex-1 truncate">
                  {personal === null
                    ? 'Loading contacts…'
                    : personal
                    ? `${personal} Trusted Contact${personal > 1 ? 's' : ''} + Campus Security Desk`
                    : 'Only Campus Security Desk is saved.'}
                </span>
                {personal === 0 && (
                  <Link
                    to="/app/sos"
                    className="font-black text-glacial underline uppercase"
                  >
                    Add Contact
                  </Link>
                )}
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Daily Wellbeing Mood Check-In */}
      <WellbeingCheckIn />

      {/* Urgent Campus Issues Feed */}
      <section aria-labelledby="issues-title">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
              CIVIC ACTION
            </span>
            <h2 id="issues-title" className="font-display text-lg font-black text-ink">
              Most Urgent on Campus
            </h2>
          </div>
          <Link
            to="/app/community"
            className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-muted hover:text-ink"
          >
            Explore All <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="panel divide-y divide-line overflow-hidden">
          {posts === null &&
            [0, 1, 2].map((i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}

          {posts?.length === 0 && (
            <div className="flex items-center justify-center gap-3 p-8 text-xs font-bold text-muted">
              <Users className="h-5 w-5" /> All campus issues currently resolved!
            </div>
          )}

          {posts?.map((p) => (
            <Link
              key={p.id}
              to={`/app/community/${p.id}`}
              className="group flex items-center gap-3.5 p-4 hover:bg-raised/70 transition-colors"
            >
              {/* Fluted severity color indicator */}
              <span
                className={`h-10 w-1.5 shrink-0 rounded-full ${SEVERITY[p.severity].bar}`}
                title={`${SEVERITY[p.severity].label} severity`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-sm text-ink group-hover:text-glacial transition-colors">
                  {p.title}
                </span>
                <span className="text-xs text-muted">
                  {timeAgo(p.created_at)} · {p.comment_count} comment{p.comment_count === 1 ? '' : 's'}
                </span>
              </span>
              <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* Classmates Who Need Support (Fundraisers) */}
      {funds?.length > 0 && (
        <section aria-labelledby="funds-title">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-glacial">
                MUTUAL AID
              </span>
              <h2 id="funds-title" className="font-display text-lg font-black text-ink">
                Classmates Who Need Support
              </h2>
            </div>
            <Link
              to="/app/fundraisers"
              className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-muted hover:text-ink"
            >
              View All <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {funds.map((f) => {
              const pct = Math.min(
                100,
                Math.round((f.amount_raised / f.amount_needed) * 100),
              );
              return (
                <Link
                  key={f.id}
                  to={`/app/fundraisers/${f.id}`}
                  className="panel group block p-4 hover:border-glacial/60 hover:shadow-tactile transition-all"
                >
                  <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted">
                    <HandCoins className="h-3.5 w-3.5 text-brass" /> For {f.beneficiary_name}
                  </p>
                  <p className="mt-1 line-clamp-1 font-bold text-sm text-ink group-hover:text-glacial transition-colors">
                    {f.title}
                  </p>

                  {/* Stepped progress meter */}
                  <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-neem transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs font-bold text-muted">
                    <span className="text-ink">{rupees(f.amount_raised)} raised</span>
                    <span>{pct}% of {rupees(f.amount_needed)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
