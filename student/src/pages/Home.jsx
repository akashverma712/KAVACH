import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HandCoins, MapPin, MessagesSquare, Phone, UserPlus, Users } from 'lucide-react';
import { Beacon } from '../components/Beacon';
import { Badge, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useGeo } from '../context/LocationContext';
import { useSos } from '../context/SosContext';
import { api } from '../lib/api';
import { SEVERITY, STATUS, timeAgo } from '../lib/format';

const MOODS = [
  { v: 4, emoji: '😄', label: 'Great' },
  { v: 3, emoji: '🙂', label: 'Okay' },
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
    try { return JSON.parse(localStorage.getItem(MOOD_KEY) || '{}'); } catch { return {}; }
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
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const k = d.toISOString().slice(0, 10);
    return { k, v: log[k], day: d.toLocaleDateString('en-IN', { weekday: 'narrow' }) };
  });

  return (
    <section className="panel p-5" aria-labelledby="checkin-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="checkin-title" className="text-lg font-bold">How are you feeling today?</h2>
          <p className="text-sm text-muted">Private to this phone. Nobody else sees it.</p>
        </div>
        <div className="flex items-end gap-1" aria-label="Your last 7 days">
          {week.map((d) => (
            <div key={d.k} className="flex flex-col items-center gap-1">
              <span className={`w-2 rounded-full ${d.v ? (d.v >= 3 ? 'bg-neem' : d.v === 2 ? 'bg-brass' : 'bg-signal') : 'bg-line'}`} style={{ height: d.v ? 8 + d.v * 6 : 8 }} />
              <span className="text-[10px] text-muted">{d.day}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => (
          <button key={m.v} type="button" role="radio" aria-checked={mood === m.v} onClick={() => pick(m.v)}
            className={`flex flex-col items-center gap-1 rounded-control border py-2.5 text-[13px] font-bold transition-colors ${mood === m.v ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink/40'}`}>
            <span className="text-2xl" aria-hidden>{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>
      {mood && mood <= 2 && (
        <div className="mt-4 rounded-control bg-raised p-4">
          <p className="font-bold">Thank you for checking in. Hard days happen, and you don’t have to carry them alone.</p>
          <p className="mt-1 text-sm text-muted">Tele-MANAS offers free, confidential counselling any time, in Hindi, English and other languages.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="tel:14416" className="inline-flex h-10 items-center gap-2 rounded-control bg-neem px-4 text-sm font-bold text-white dark:text-night"><Phone className="h-4 w-4" /> Call 14416</a>
            <Link to="/app/chat" className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-bold"><MessagesSquare className="h-4 w-4" /> Talk to the assistant</Link>
          </div>
        </div>
      )}
      {mood && mood >= 3 && <p className="mt-3 text-sm text-muted">Glad to hear it. Check in again tomorrow.</p>}
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
    api('/posts?sort=severity&status=active&limit=3').then((d) => setPosts(d.items)).catch(() => setPosts([]));
    api('/fundraisers?limit=2').then((d) => setFunds(d.items)).catch(() => setFunds([]));
  }, []);

  const personal = contacts?.contacts?.length ?? null;
  const locText = {
    ok: geo.coords ? `Location on, accurate to about ${Math.round(geo.coords.accuracy)} m` : 'Location on',
    locating: 'Finding your location…',
    denied: 'Location is blocked. SOS will be sent without a map link.',
    unavailable: 'Location unavailable right now',
    unsupported: 'This browser can’t share location',
    idle: 'Starting location…',
  }[geo.status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.9rem] font-extrabold">{greeting()}, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted">{[user?.branch, user?.batch].filter(Boolean).join(', ') || 'Welcome to Kavach'}</p>
      </div>

      <section className="panel overflow-hidden">
        <div className="grid items-center gap-2 md:grid-cols-[auto_1fr]">
          <div className="flex justify-center px-4 pt-4 md:py-4 md:pl-6">
            <Beacon size={150} sub="Tap for help" onPress={() => trigger('button')} />
          </div>
          <div className="px-5 pb-5 md:py-6 md:pr-8">
            <h2 className="text-xl font-bold">Emergency SOS</h2>
            <p className="mt-1 text-muted">Tap the button and you get 10 seconds to cancel. Then your location goes by SMS to your contacts and the campus admin.</p>
            <ul className="mt-4 space-y-2 text-[15px]">
              <li className="flex items-start gap-2.5">
                <MapPin className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${geo.status === 'ok' ? 'text-neem' : 'text-brass'}`} />
                <span>{locText}{geo.status === 'denied' || geo.status === 'unavailable' ? <button type="button" onClick={geo.retry} className="ml-2 font-bold underline">Try again</button> : null}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <UserPlus className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${personal ? 'text-neem' : 'text-brass'}`} />
                <span>
                  {personal === null ? 'Loading contacts…' : personal ? `${personal} personal contact${personal > 1 ? 's' : ''} + campus admin` : 'Only the campus admin is saved. '}
                  {personal === 0 && <Link to="/app/sos" className="font-bold underline">Add a contact</Link>}
                </span>
              </li>
              {status && <li className="pl-7 text-sm text-muted">{status.remaining} of {status.max} alerts available this hour</li>}
            </ul>
          </div>
        </div>
      </section>

      <WellbeingCheckIn />

      <section aria-labelledby="issues-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="issues-title" className="text-lg font-bold">Most urgent on campus</h2>
          <Link to="/app/community" className="flex items-center text-sm font-bold text-muted hover:text-ink">See all <ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="panel divide-y divide-line">
          {posts === null && [0, 1, 2].map((i) => <div key={i} className="p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="mt-2 h-4 w-1/3" /></div>)}
          {posts?.length === 0 && (
            <div className="flex items-center gap-3 p-5 text-muted"><Users className="h-5 w-5" /> No open problems right now.</div>
          )}
          {posts?.map((p) => (
            <Link key={p.id} to={`/app/community/${p.id}`} className="flex items-center gap-3 p-4 hover:bg-raised">
              <span className={`h-10 w-1 shrink-0 rounded-full ${SEVERITY[p.severity].bar}`} title={`${SEVERITY[p.severity].label} severity`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{p.title}</span>
                <span className="text-sm text-muted">{timeAgo(p.created_at)}, {p.comment_count} comment{p.comment_count === 1 ? '' : 's'}</span>
              </span>
              <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
            </Link>
          ))}
        </div>
      </section>

      {funds?.length > 0 && (
        <section aria-labelledby="funds-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="funds-title" className="text-lg font-bold">Classmates who need support</h2>
            <Link to="/app/fundraisers" className="flex items-center text-sm font-bold text-muted hover:text-ink">See all <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {funds.map((f) => {
              const pct = Math.min(100, Math.round((f.amount_raised / f.amount_needed) * 100));
              return (
                <Link key={f.id} to={`/app/fundraisers/${f.id}`} className="panel block p-4 hover:border-ink/30">
                  <p className="flex items-center gap-2 text-sm font-bold text-muted"><HandCoins className="h-4 w-4" /> For {f.beneficiary_name}</p>
                  <p className="mt-1 line-clamp-2 font-bold">{f.title}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-neem" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1.5 text-sm text-muted">{pct}% of goal raised</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
