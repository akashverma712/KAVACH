import { useState } from 'react';
import { api } from '../lib/api';
import { REACTIONS } from '../lib/format';
import { useToast } from '../context/ToastContext';

export function ReactionBar({ post, onChange, size = 'md' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const react = async (type, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const r = await api(`/posts/${post.id}/react`, { method: 'POST', body: { type } });
      onChange?.({ ...post, ...r });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
      {REACTIONS.map((r) => {
        const count = post.reactions?.[r.type] || 0;
        const mine = post.my_reaction === r.type;
        return (
          <button key={r.type} type="button" onClick={(e) => react(r.type, e)} aria-pressed={mine} title={r.label}
            aria-label={`${r.label}${count ? `, ${count}` : ''}`}
            className={`inline-flex items-center gap-1 rounded-full border transition-colors ${size === 'sm' ? 'h-8 px-2 text-[13px]' : 'h-9 px-2.5 text-sm'} ${
              mine ? 'border-ink bg-ink/10 font-bold dark:bg-white/10' : 'border-line bg-surface hover:border-ink/30'}`}>
            <span aria-hidden className="text-base leading-none">{r.emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
