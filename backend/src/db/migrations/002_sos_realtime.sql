-- Migration 002: Realtime SOS, idempotency, location trail, and resolution

-- 1. Update status check to include 'sending'
ALTER TABLE sos_events DROP CONSTRAINT IF EXISTS sos_events_status_check;
ALTER TABLE sos_events ADD CONSTRAINT sos_events_status_check
  CHECK (status IN ('sending', 'sent', 'partial', 'failed'));

-- 2. Add columns for idempotency, voice transcript, live location, and resolution
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS last_accuracy DOUBLE PRECISION;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS resolution_note TEXT;

ALTER TABLE sos_events DROP CONSTRAINT IF EXISTS sos_events_resolved_by_check;
ALTER TABLE sos_events ADD CONSTRAINT sos_events_resolved_by_check
  CHECK (resolved_by IS NULL OR resolved_by IN ('student', 'admin'));

-- 3. Idempotency unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_sos_client_id
  ON sos_events (user_id, client_id) WHERE client_id IS NOT NULL;

-- 4. Location trail table
CREATE TABLE IF NOT EXISTS sos_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id     UUID NOT NULL REFERENCES sos_events(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  accuracy   DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sos_locations_sos ON sos_locations (sos_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sos_active ON sos_events (created_at DESC) WHERE resolved_at IS NULL;
