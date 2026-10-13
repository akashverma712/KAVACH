import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, Info, Siren } from 'lucide-react';
import { PageHeader, Stat } from '../components/kit';
import { Badge, PageLoader } from '../components/ui';
import { api } from '../lib/api';
import { SEVERITY, STATUS, rupees, timeAgo } from '../lib/format';

function Trend({ data }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.problems, d.sos)));
  const W = 560; const H = 150; const bw = W / data.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Problems and SOS alerts per day over the last 14 days">
        {[0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} className="stroke-line" strokeDasharray="3 4" />)}
        {data.map((d, i) => {
          const ph = (d.problems / max) * (H - 8); const sh = (d.sos / max) * (H - 8);
          const x = i * bw + bw * 0.18; const w = bw * 0.3;
          return (
            <g key={d.day}>
              <rect x={x} y={H - ph} width={w} height={ph} rx="2" className="fill-ink"><title>{`${d.day}: ${d.problems} problems`}</title></rect>
              <rect x={x + w + 2} y={H - sh} width={w} height={sh} rx="2" className="fill-signal"><title>{`${d.day}: ${d.sos} SOS`}</title></rect>
              {(i % 2 === 1 || data.length < 8) && <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" className="fill-muted text-[10px]">{new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-sm text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" /> Problems posted</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-signal" /> SOS alerts</span>
      </figcaption>
    </figure>
  );
}

const STATUS_ORDER = ['open', 'marked_for_solving', 'in_progress', 'under_review', 'solved', 'closed'];
const STATUS_FILL = { open: 'bg-muted/50', marked_for_solving: 'bg-brass/60', in_progress: 'bg-ink', under_review: 'bg-brass', solved: 'bg-neem', closed: 'bg-line' };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const load = () => api('/admin/dashboard').then(setD).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (error) return <p className="rounded-control bg-signal/10 px-4 py-3 font-bold text-signal">{error}</p>;
  if (!d) return <PageLoader />;
  const s = d.stats;
  const totalPosts = Object.values(d.problems_by_status).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard">What needs your attention across campus right now.</PageHeader>

      {(d.delivery.email === 'console' || d.delivery.sms === 'console') && (
        <div className="flex items-start gap-3 rounded-panel border border-brass/40 bg-brass/10 p-4 text-[15px]">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brass" />
          <p>
            <span className="font-bold">Development delivery mode. </span>
            {d.delivery.email === 'console' && 'Emails '}{d.delivery.email === 'console' && d.delivery.sms === 'console' && 'and '}{d.delivery.sms === 'console' && 'SMS '}
            (OTPs and SOS alerts) are printed in the backend terminal. Add SMTP and Twilio credentials to <code className="rounded bg-raised px-1">backend/.env</code> to deliver them for real.
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-4">
        <Stat label="SOS in last 24 h" value={s.sos_24h} sub={`${s.sos_unacknowledged} awaiting response`} tone={s.sos_unacknowledged ? 'signal' : undefined} />
        <Stat label="Open problems" value={s.open_problems} sub={`${s.urgent_problems} high or critical`} tone={s.urgent_problems ? 'brass' : undefined} />
        <Stat label="Posts reported" value={s.pending_reports} sub="waiting for review" tone={s.pending_reports ? 'signal' : undefined} />
        <Stat label="Fundraisers to review" value={s.pending_fundraisers} sub="pending approval" tone={s.pending_fundraisers ? 'brass' : undefined} />
        <Stat label="Students on roster" value={s.roster} />
        <Stat label="Registered accounts" value={s.users} sub={`${s.users_week} new this week`} />
        <Stat label="Suspended or banned" value={s.moderated_users} />
        <Stat label="Registration rate" value={s.roster ? `${Math.round((s.users / s.roster) * 100)}%` : '–'} sub="of roster signed up" tone="neem" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="mb-4 font-bold">Last 14 days</h2>
          <Trend data={d.trend} />
        </section>
        <section className="panel p-5">
          <h2 className="font-bold">Problems by status</h2>
          <p className="text-sm text-muted">{totalPosts} total</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-raised">
            {STATUS_ORDER.map((k) => d.problems_by_status[k] ? <span key={k} className={STATUS_FILL[k]} style={{ width: `${(d.problems_by_status[k] / totalPosts) * 100}%` }} title={`${STATUS[k].label}: ${d.problems_by_status[k]}`} /> : null)}
          </div>
          <ul className="mt-4 space-y-2 text-[15px]">
            {STATUS_ORDER.map((k) => (
              <li key={k} className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_FILL[k]}`} />
                <span className="flex-1">{STATUS[k].label}</span>
                <span className="font-bold tabular-nums">{d.problems_by_status[k] || 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-bold"><Siren className="h-[18px] w-[18px] text-signal" /> Recent SOS</h2>
            <Link to="/sos" className="flex items-center text-sm font-bold text-muted hover:text-ink">All <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <ul className="divide-y divide-line">
            {d.recent_sos.length === 0 && <li className="px-5 py-8 text-center text-muted">No SOS alerts yet.</li>}
            {d.recent_sos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.acknowledged_at ? 'bg-neem' : 'bg-signal'}`} aria-label={a.acknowledged_at ? 'Responded' : 'Awaiting response'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.name}</p>
                  <p className="text-sm text-muted">{timeAgo(a.created_at)}{a.regd_no ? `, ${a.regd_no}` : ''}</p>
                </div>
                {a.lat && <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Open location"><ExternalLink className="h-4 w-4" /></a>}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-bold">Top priority problems</h2>
            <Link to="/problems" className="flex items-center text-sm font-bold text-muted hover:text-ink">All <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <ul className="divide-y divide-line">
            {d.urgent_problems.length === 0 && <li className="px-5 py-8 text-center text-muted">No open problems.</li>}
            {d.urgent_problems.map((p) => (
              <li key={p.id}>
                <Link to={`/problems?open=${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raised">
                  <span className={`h-9 w-1 shrink-0 rounded-full ${SEVERITY[p.severity].bar}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="block truncate font-bold">{p.title}</span>
                      {p.priority_score !== undefined && (
                        <span className="shrink-0 text-xs font-bold tabular-nums text-muted">Score {p.priority_score}</span>
                      )}
                    </span>
                    <span className="text-sm text-muted">{STATUS[p.status].label}, {timeAgo(p.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-bold">Fundraisers to review</h2>
            <Link to="/fundraisers" className="flex items-center text-sm font-bold text-muted hover:text-ink">All <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <ul className="divide-y divide-line">
            {d.pending_fundraisers.length === 0 && <li className="px-5 py-8 text-center text-muted">Nothing waiting for review.</li>}
            {d.pending_fundraisers.map((f) => (
              <li key={f.id}>
                <Link to={`/fundraisers?open=${f.id}`} className="block px-5 py-3 hover:bg-raised">
                  <span className="block truncate font-bold">{f.title}</span>
                  <span className="flex items-center gap-2 text-sm text-muted">{rupees(f.amount_needed)}, by {f.organiser_name} <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
