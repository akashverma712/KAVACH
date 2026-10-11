import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, XCircle } from 'lucide-react';
import { SEVERITY, rupees, timeAgo } from '../lib/format';
import { Badge } from './ui';

const STATE = {
  pending: { label: 'Waiting for admin review', tone: 'brass', icon: Clock },
  approved: { label: 'Verified by admin', tone: 'neem', icon: BadgeCheck },
  rejected: { label: 'Needs changes', tone: 'signal', icon: XCircle },
  closed: { label: 'Closed', tone: 'muted', icon: null },
};

export function FundCard({ f }) {
  const pct = Math.min(100, Math.round((f.amount_raised / f.amount_needed) * 100));
  const st = STATE[f.status];
  return (
    <Link to={`/app/fundraisers/${f.id}`} className="panel flex flex-col overflow-hidden hover:border-ink/30">
      {f.qr_images?.[0] && (
        <div className="flex h-36 items-center justify-center gap-3 border-b border-line bg-raised p-3">
          {f.qr_images.slice(0, 3).map((q) => <img key={q} src={q} alt="" loading="lazy" className="h-full rounded-md bg-white object-contain p-1" />)}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.icon && <st.icon className="h-3.5 w-3.5" />}{st.label}</Badge>
          {f.severity >= 3 && <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>}
        </div>
        <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{f.title}</h3>
        <p className="mt-0.5 text-sm text-muted">For {f.beneficiary_name}, started by {f.is_owner ? 'you' : f.organiser_name} {timeAgo(f.created_at)}</p>
        <div className="mt-auto pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-neem" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1.5 flex justify-between text-sm"><span className="font-bold">{rupees(f.amount_raised)}</span><span className="text-muted">of {rupees(f.amount_needed)}</span></p>
        </div>
      </div>
    </Link>
  );
}
