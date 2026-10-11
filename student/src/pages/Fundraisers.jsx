import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins, Plus } from 'lucide-react';
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
    } catch (err) { setError(err.message); setItems((x) => x || []); }
  };
  useEffect(() => { setItems(null); setError(null); load(1); }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.9rem] font-extrabold">Fundraisers</h1>
          <p className="max-w-xl text-muted">Every fundraiser is checked by the admin against proof before it appears here. Payments go directly to the QR codes shown.</p>
        </div>
        <Link to="/app/fundraisers/new" className="inline-flex h-11 items-center gap-2 rounded-control bg-ink px-4 font-bold text-bg hover:bg-ink/90"><Plus className="h-5 w-5" /> Start a fundraiser</Link>
      </div>
      <Segmented className="mt-5" label="Show" value={scope} onChange={setScope} options={[{ value: 'active', label: 'Active' }, { value: 'mine', label: 'Started by me' }]} />
      {error && <p className="mt-4 rounded-control bg-signal/10 px-4 py-3 font-bold text-signal">{error}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items === null && [0, 1, 2].map((i) => <div key={i} className="panel p-4"><Skeleton className="h-32 w-full" /><Skeleton className="mt-4 h-5 w-3/4" /><Skeleton className="mt-4 h-2 w-full" /></div>)}
        {items?.map((f) => <FundCard key={f.id} f={f} />)}
      </div>
      {items?.length === 0 && !error && (
        <EmptyState icon={HandCoins} title={scope === 'mine' ? 'You haven’t started a fundraiser' : 'No active fundraisers'}
          action={<Link to="/app/fundraisers/new" className="font-bold underline">Start a fundraiser</Link>}>
          {scope === 'mine' ? 'If you or a classmate needs money for an accident or medical emergency, you can raise it here.' : 'When a student needs urgent support and the admin verifies it, it will show up here.'}
        </EmptyState>
      )}
      {hasMore && <div className="mt-6 flex justify-center"><Button variant="outline" onClick={() => load(page + 1)}>Load more</Button></div>}
    </div>
  );
}
