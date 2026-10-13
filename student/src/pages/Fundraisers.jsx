import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins, Plus, ShieldCheck } from 'lucide-react';
import { FundCard } from '../components/FundCard';
import { Button, EmptyState, Segmented, Skeleton } from '../components/ui';
import { api } from '../lib/api';

export default function Fundraisers() {
  const [scope, setScope] = useState('active');
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const load = async (p = 1) => {
    try {
      const d = await api(`/fundraisers?scope=${scope}&page=${p}`);
      setItems((prev) => (p === 1 ? d.items : [...(prev || []), ...d.items]));
      setHasMore(d.has_more);
      setPage(p);
    } catch (err) {
      setError(err.message);
      setItems((x) => x || []);
    }
  };

  useEffect(() => {
    setItems(null);
    setError(null);
    load(1);
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-glacial">
            MUTUAL AID
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-ink">
            Verified Student Fundraisers
          </h1>
          <p className="max-w-xl text-xs text-muted mt-0.5">
            Every fundraiser is audited by college admin against medical and accident proofs. Contributions transfer directly to student UPI handles.
          </p>
        </div>

        <Link
          to="/app/fundraisers/new"
          className="inline-flex h-10 items-center gap-2 rounded-control bg-ink px-4 text-xs font-black uppercase tracking-wider text-bg shadow-sm hover:bg-ink/90 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" /> Start a Fundraiser
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Segmented
          label="Show fundraisers"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'active', label: 'Active Fundraisers' },
            { value: 'mine', label: 'My Fundraisers' },
          ]}
        />
      </div>

      {error && (
        <p className="rounded-control bg-signal/10 border border-signal/30 p-4 font-bold text-xs text-signal">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items === null &&
          [0, 1, 2].map((i) => (
            <div key={i} className="panel p-5 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-2.5 w-full" />
            </div>
          ))}

        {items?.map((f) => (
          <FundCard key={f.id} f={f} />
        ))}
      </div>

      {items?.length === 0 && !error && (
        <EmptyState
          icon={HandCoins}
          title={scope === 'mine' ? 'You have not launched any fundraisers' : 'No active student fundraisers'}
          action={
            <Link
              to="/app/fundraisers/new"
              className="inline-flex h-10 items-center gap-2 rounded-control bg-ink px-5 text-xs font-black uppercase tracking-wider text-bg"
            >
              Start a Fundraiser
            </Link>
          }
        >
          {scope === 'mine'
            ? 'If you or a fellow student is facing a medical crisis, hospital bill, or emergency expense, you can initiate a fundraiser with admin verification.'
            : 'When a BIT Sindri classmate requires emergency assistance and passes verification, their fundraiser will appear here.'}
        </EmptyState>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => load(page + 1)}>
            Load More Fundraisers
          </Button>
        </div>
      )}
    </div>
  );
}
