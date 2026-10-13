import { Link } from 'react-router-dom';
import { EyeOff, Lock, MessageCircle, Users } from 'lucide-react';
import { CATEGORIES, SEVERITY, STATUS, timeAgo } from '../lib/format';
import { LikeButton } from './LikeButton';
import { Avatar, Badge } from './ui';

const SEV_TEXT = {
  1: 'text-neem',
  2: 'text-muted',
  3: 'text-brass',
  4: 'text-signal',
};

export function PostCard({ post, onChange, showVisibility = false }) {
  const sev = SEVERITY[post.severity] || SEVERITY[1];
  const sevNum = Number(post.severity) || 1;
  const isAdminOnly = post.visibility === 'admin';

  return (
    <article className="panel group relative overflow-hidden transition-all hover:border-glacial/60 hover:shadow-tactile">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={post.author_name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-sm text-ink">
                {post.author_name}
                {post.is_owner && (
                  <span className="font-extrabold text-[11px] text-glacial ml-1.5 uppercase">
                    (You)
                  </span>
                )}
              </p>
              <p className="truncate text-xs font-bold text-muted">
                {[post.author_branch, post.author_batch].filter(Boolean).join(' · ')}
                {post.author_branch || post.author_batch ? ' · ' : ''}
                {timeAgo(post.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Fluted barcode vertical bars */}
            <div className="flex items-center gap-1" title={`${sev.label} Severity`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-5 w-1 rounded-full transition-all ${
                    i < sevNum ? sev.bar : 'bg-line/60'
                  }`}
                />
              ))}
            </div>
            <Badge tone={STATUS[post.status].tone} dot>
              {STATUS[post.status].label}
            </Badge>
          </div>
        </div>

        <Link
          to={`/app/community/${post.id}`}
          className="mt-3.5 block focus-visible:outline-offset-4"
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold">
            {(showVisibility || isAdminOnly) && (
              isAdminOnly ? (
                <Badge tone="ink">
                  <Lock className="h-3 w-3 mr-1 inline" /> Admin only
                </Badge>
              ) : (
                <Badge tone="muted">
                  <Users className="h-3 w-3 mr-1 inline" /> Everyone
                </Badge>
              )
            )}
            <span className={`font-black uppercase tracking-wider ${SEV_TEXT[post.severity]}`}>
              {sev.label} Severity
            </span>
            <span className="text-muted/60">·</span>
            <span className="rounded-tag bg-raised px-2 py-0.5 text-muted uppercase font-extrabold text-[10.5px]">
              {CATEGORIES[post.category] || 'Other'}
            </span>
            {post.is_hidden && (
              <span className="inline-flex items-center gap-1 rounded-tag bg-brass/15 px-2 py-0.5 text-[10.5px] font-extrabold text-brass">
                <EyeOff className="h-3 w-3" /> Hidden
              </span>
            )}
          </div>

          <h3 className="font-display text-lg font-bold text-ink leading-snug group-hover:text-glacial transition-colors">
            {post.title}
          </h3>
          <p className="mt-1.5 line-clamp-3 text-sm text-muted leading-relaxed">
            {post.description}
          </p>

          {post.images?.length > 0 && (
            <div
              className={`mt-4 grid gap-2 ${
                post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {post.images.slice(0, 4).map((src, i) => (
                <div
                  key={src}
                  className={`relative overflow-hidden rounded-control border border-line bg-raised ${
                    post.images.length === 1
                      ? 'aspect-[16/9]'
                      : 'aspect-square'
                  } ${
                    post.images.length === 3 && i === 0
                      ? 'col-span-2 aspect-[16/9]'
                      : ''
                  }`}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          )}
        </Link>

        {/* Footer: Like / comments or Private note */}
        {isAdminOnly ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Private problem — only you and campus admin can see it</span>
            </p>
            <Link
              to={`/app/community/${post.id}`}
              className="text-xs font-bold text-ink hover:underline shrink-0"
            >
              View updates →
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
            <LikeButton post={post} onChange={onChange} size="sm" />
            <Link
              to={`/app/community/${post.id}#comments`}
              className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-bold text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{post.comment_count}</span>
              <span className="hidden sm:inline">comment{post.comment_count === 1 ? '' : 's'}</span>
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
