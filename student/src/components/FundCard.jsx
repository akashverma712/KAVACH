import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, XCircle, QrCode } from 'lucide-react';
import { SEVERITY, rupees, timeAgo } from '../lib/format';
import { Badge } from './ui';

const STATE = {
  pending: { label: 'Admin Reviewing', tone: 'brass', icon: Clock },
  approved: { label: 'Verified by Admin', tone: 'neem', icon: BadgeCheck },
  rejected: { label: 'Revisions Needed', tone: 'signal', icon: XCircle },
  closed: { label: 'Closed', tone: 'muted', icon: null },
};

export function FundCard({ f }) {
  const pct = Math.min(100, Math.round((f.amount_raised / f.amount_needed) * 100));
  const st = STATE[f.status] || STATE.pending;

  return (
    <Link
      to={`/app/fundraisers/${f.id}`}
      className="panel group flex flex-col overflow-hidden transition-all hover:border-glacial/60 hover:shadow-tactile active:scale-[0.99]"
    >
      {/* QR Codes Banner Preview */}
      {f.qr_images?.[0] ? (
        <div className="flex h-36 items-center justify-center gap-3 border-b border-line bg-raised/70 p-3">
          {f.qr_images.slice(0, 3).map((q, idx) => (
            <div
              key={q + idx}
              className="h-full rounded-control border border-line bg-white p-1.5 shadow-sm"
            >
              <img
                src={q}
                alt="Payment QR"
                loading="lazy"
                className="h-full w-auto object-contain rounded-[4px]"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center border-b border-line bg-raised/40 p-3 text-muted">
          <QrCode className="h-6 w-6 opacity-40" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>
            {st.icon && <st.icon className="h-3 w-3" />}
            {st.label}
          </Badge>
          {f.severity >= 3 && (
            <Badge tone={SEVERITY[f.severity].tone}>
              {SEVERITY[f.severity].label} Priority
            </Badge>
          )}
        </div>

        <h3 className="mt-3 font-display line-clamp-2 text-base sm:text-lg font-black text-ink leading-snug group-hover:text-glacial transition-colors">
          {f.title}
        </h3>

        <p className="mt-1 text-xs text-muted">
          For <span className="font-extrabold text-ink">{f.beneficiary_name}</span> ·{' '}
          {f.is_owner ? 'Organized by you' : `Started by ${f.organiser_name}`}{' '}
          {timeAgo(f.created_at)}
        </p>

        {/* Financial Progress Meter */}
        <div className="mt-auto pt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-line/80">
            <div
              className="h-full rounded-full bg-neem transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between text-xs font-bold">
            <span className="font-mono text-sm font-black text-ink">
              {rupees(f.amount_raised)}
            </span>
            <span className="text-muted">
              {pct}% of <span className="font-mono text-ink">{rupees(f.amount_needed)}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
