-- Kavach initial schema
-- gen_random_uuid() is built into PostgreSQL 13+

CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Official college roster maintained by the admin (manual entry or CSV/XLSX import)
CREATE TABLE IF NOT EXISTS college_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  branch     TEXT,
  batch      TEXT,
  regd_no    TEXT NOT NULL UNIQUE,
  email      TEXT UNIQUE,
  phone      TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_college_records_name ON college_records (lower(name));

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_record_id UUID REFERENCES college_records(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  email             TEXT UNIQUE,
  phone             TEXT UNIQUE,
  password_hash     TEXT NOT NULL,
  branch            TEXT,
  batch             TEXT,
  regd_no           TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  suspended_until   TIMESTAMPTZ,
  moderation_reason TEXT,
  token_version     INTEGER NOT NULL DEFAULT 0,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_contact_present CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_users_name ON users (lower(name));

-- One row per OTP "session" (registration, login, admin login)
CREATE TABLE IF NOT EXISTS otps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose      TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'reset', 'admin_login')),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_id     UUID REFERENCES admins(id) ON DELETE CASCADE,
  destinations JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel      TEXT CHECK (channel IN ('email', 'phone')),
  code_hash    TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts     INTEGER NOT NULL DEFAULT 0,
  sends        INTEGER NOT NULL DEFAULT 0,
  ip           TEXT,
  last_sent_at TIMESTAMPTZ,
  code_expires_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps (expires_at);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  relation   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sos_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  accuracy        DOUBLE PRECISION,
  trigger         TEXT NOT NULL DEFAULT 'button' CHECK (trigger IN ('button', 'voice', 'offline_sync')),
  message         TEXT NOT NULL,
  recipients      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partial', 'failed')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_note      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sos_user_time ON sos_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_time ON sos_events (created_at DESC);

CREATE TABLE IF NOT EXISTS posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'other',
  severity         SMALLINT NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 4),
  images           TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'marked_for_solving', 'in_progress', 'under_review', 'solved', 'closed')),
  admin_resolved   BOOLEAN NOT NULL DEFAULT false,
  student_resolved BOOLEAN NOT NULL DEFAULT false,
  closed_at        TIMESTAMPTZ,
  closed_by        TEXT CHECK (closed_by IN ('owner', 'mutual', 'admin')),
  is_hidden        BOOLEAN NOT NULL DEFAULT false,
  hidden_reason    TEXT,
  report_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_recent ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_severity ON posts (severity DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id);

CREATE TABLE IF NOT EXISTS post_updates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  actor      TEXT NOT NULL CHECK (actor IN ('admin', 'owner', 'system')),
  admin_id   UUID REFERENCES admins(id) ON DELETE SET NULL,
  status     TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_updates_post ON post_updates (post_id, created_at);

CREATE TABLE IF NOT EXISTS reactions (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('like', 'love', 'support', 'wow', 'sad', 'angry')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS fundraisers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  story            TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  amount_needed    NUMERIC(12, 2) NOT NULL CHECK (amount_needed > 0),
  amount_raised    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_raised >= 0),
  severity         SMALLINT NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 4),
  upi_id           TEXT,
  qr_images        TEXT[] NOT NULL DEFAULT '{}',
  proof_files      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'closed')),
  admin_note       TEXT,
  reviewed_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fundraisers_status ON fundraisers (status, created_at DESC);

CREATE TABLE IF NOT EXISTS faqs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  keywords   TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'general',
  search     TSVECTOR GENERATED ALWAYS AS (
               setweight(to_tsvector('english', coalesce(question, '')), 'A') ||
               setweight(to_tsvector('english', coalesce(keywords, '')), 'A') ||
               setweight(to_tsvector('english', coalesce(answer, '')), 'C')
             ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faqs_search ON faqs USING GIN (search);

-- Shared rate-limit counters so limits hold across multiple API instances
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  hits     INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id   UUID,
  action     TEXT NOT NULL,
  target     TEXT,
  meta       JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (created_at DESC);
