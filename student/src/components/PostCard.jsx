import { Link } from 'react-router-dom';
import { EyeOff, MessageCircle } from 'lucide-react';
import { CATEGORIES, SEVERITY, STATUS, timeAgo } from '../lib/format';
import { ReactionBar } from './ReactionBar';
import { Avatar, Badge } from './ui';

const SEV_TEXT = { 1: 'text-neem', 2: 'text-muted', 3: 'text-brass', 4: 'text-signal' };

export function PostCard({ post, onChange }) {
  const sev = SEVERITY[post.severity];
  return (
    <article className="panel relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${sev.bar}`} aria-hidden />
      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-center gap-3">
          <Avatar name={post.author_name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{post.author_name}{post.is_owner && <span className="font-normal text-muted"> (you)</span>}</p>
            <p className="truncate text-[13px] text-muted">{[post.author_branch, post.author_batch].filter(Boolean).join(', ')}{post.author_branch || post.author_batch ? ', ' : ''}{timeAgo(post.created_at)}</p>
          </div>
          <Badge tone={STATUS[post.status].tone} dot>{STATUS[post.status].label}</Badge>
        </div>

        <Link to={`/app/community/${post.id}`} className="mt-3 block rounded-control focus-visible:outline-offset-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <span className={SEV_TEXT[post.severity]}>{sev.label} severity</span>
            <span className="text-muted">in {CATEGORIES[post.category] || 'Other'}</span>
            {post.is_hidden && <span className="inline-flex items-center gap-1 text-brass"><EyeOff className="h-3.5 w-3.5" /> Hidden from others</span>}
          </div>
          <h3 className="text-lg font-bold leading-snug">{post.title}</h3>
          <p className="mt-1 line-clamp-3 text-[15px] text-muted">{post.description}</p>
          {post.images?.length > 0 && (
            <div className={`mt-3 grid gap-1.5 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {post.images.slice(0, 4).map((src, i) => (
                <div key={src} className={`relative overflow-hidden rounded-control bg-raised ${post.images.length === 1 ? 'aspect-[16/9]' : 'aspect-square'} ${post.images.length === 3 && i === 0 ? 'col-span-2 aspect-[16/9]' : ''}`}>
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <ReactionBar post={post} onChange={onChange} size="sm" />
          <Link to={`/app/community/${post.id}#comments`} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
            <MessageCircle className="h-4 w-4" /> {post.comment_count} <span className="sr-only">comments</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
