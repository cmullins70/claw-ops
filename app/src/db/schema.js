/**
 * Phase 1 SQLite schema for Claw Ops.
 * Covers: signals, incidents, action_attempts.
 * Matches docs/schemas.md definitions.
 */
export const SCHEMA_SQL = `
-- Raw or near-raw operational input before incident normalization
CREATE TABLE IF NOT EXISTS signals (
  signal_id       TEXT PRIMARY KEY,
  timestamp       TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK(source_type IN ('prometheus','loki','uptime','cron','openclaw','custom')),
  source_name     TEXT NOT NULL,
  signal_name     TEXT NOT NULL,
  component       TEXT NOT NULL CHECK(component IN ('host','container','gateway','cron','memory','prompt','tooling','security')),
  entity_id       TEXT,
  severity        TEXT NOT NULL CHECK(severity IN ('info','warning','high','critical')),
  summary         TEXT NOT NULL,
  labels          TEXT DEFAULT '{}',
  annotations     TEXT DEFAULT '{}',
  evidence        TEXT DEFAULT '{}',
  dedup_key       TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_dedup_key ON signals(dedup_key);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);

-- Normalized operational issue
CREATE TABLE IF NOT EXISTS incidents (
  incident_id       TEXT PRIMARY KEY,
  fingerprint       TEXT NOT NULL,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','investigating','mitigated','resolved','suppressed')),
  severity          TEXT NOT NULL CHECK(severity IN ('info','warning','high','critical')),
  root_cause_class  TEXT,
  confidence        REAL,
  components        TEXT NOT NULL DEFAULT '[]',
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  recurrence_count  INTEGER NOT NULL DEFAULT 1,
  evidence          TEXT NOT NULL DEFAULT '[]',
  actions_attempted TEXT NOT NULL DEFAULT '[]',
  approval_state    TEXT,
  suppression_until TEXT,
  linked_lessons      TEXT NOT NULL DEFAULT '[]',
  linked_improvements TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_fingerprint ON incidents(fingerprint);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_last_seen ON incidents(last_seen_at);

-- Tracks what the system attempted for an incident
CREATE TABLE IF NOT EXISTS action_attempts (
  action_id          TEXT PRIMARY KEY,
  incident_id        TEXT NOT NULL REFERENCES incidents(incident_id),
  action             TEXT NOT NULL,
  policy_class       TEXT NOT NULL CHECK(policy_class IN ('autonomous','approval_gated','human_only')),
  requested_at       TEXT NOT NULL,
  executed_at        TEXT,
  requested_by       TEXT NOT NULL CHECK(requested_by IN ('agent','human','system')),
  status             TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','executed','blocked','failed','rolled_back')),
  result_summary     TEXT,
  verification_result TEXT CHECK(verification_result IS NULL OR verification_result IN ('pending','improved','no_change','worsened')),
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_action_attempts_incident ON action_attempts(incident_id);
`;
