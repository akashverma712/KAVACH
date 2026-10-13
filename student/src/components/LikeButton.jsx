import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

export function LikeButton({ post, onChange, size = 'sm' }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const liked = post.my_reaction === 'like' || Boolean(post.liked);
  const count = post.like_count ?? 0;

  const toggle = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (pending) return;

    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));
    const prevPost = { ...post };

    // Optimistic update
    onChange?.({
      ...post,
      my_reaction: nextLiked ? 'like' : null,
      liked: nextLiked,
      like_count: nextCount,
    });
    setPending(true);

    try {
      const res = await api(`/posts/${post.id}/like`, { method: 'POST' });
      onChange?.({
        ...post,
        my_reaction: res.liked ? 'like' : null,
        liked: res.liked,
        like_count: res.like_count,
      });
    } catch (err) {
      // Roll back on failure
      onChange?.(prevPost);
      toast.error(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      title={liked ? 'Remove like' : 'I face this too'}
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold transition-all ${
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'
      } ${
        liked
          ? 'border-ink bg-ink text-bg shadow-sm'
          : 'border-line bg-surface text-muted hover:border-ink/40 hover:text-ink'
      }`}
    >
      <ThumbsUp className={`shrink-0 ${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
      <span className="tabular-nums">{count > 0 ? count : ''}</span>
      <span className="hidden sm:inline font-medium">
        {liked ? 'Facing this' : 'I face this too'}
      </span>
    </button>
  );
}
