-- Migration 003: Post visibility (everyone or admin only)

ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'everyone';

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check
  CHECK (visibility IN ('everyone', 'admin'));

UPDATE posts SET visibility = 'everyone' WHERE visibility IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts (visibility);
