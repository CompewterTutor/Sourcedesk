-- SourceDesk initial DB schema
-- Compatible with both SQLite and PostgreSQL.
-- Applied automatically on server startup via db.runMigrations().

-- ─── Migration bookkeeping ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL
);

-- ─── Users ────────────────────────────────────────────────────────────────────
-- One row per human user. email is the canonical identifier.
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  label       TEXT,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ─── API tokens ───────────────────────────────────────────────────────────────
-- Tokens map to a user and can be revoked individually.
-- Generate with: node scripts/generate_api_token.js --user you@example.com
CREATE TABLE IF NOT EXISTS api_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  label       TEXT,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  expires_at  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token   ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);

-- ─── Email ingests ────────────────────────────────────────────────────────────
-- One record per POST to /api/email-ingest.
CREATE TABLE IF NOT EXISTS email_ingests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT,
  received_at TEXT NOT NULL,
  email_count INTEGER NOT NULL DEFAULT 0,
  filename    TEXT,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_email_ingests_project ON email_ingests(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_email_ingests_user    ON email_ingests(user_id);

-- ─── Email threads ────────────────────────────────────────────────────────────
-- One row per unique thread (project_id + user_id + thread_key).
-- Updated incrementally when new messages arrive for the same thread.
CREATE TABLE IF NOT EXISTS email_threads (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  thread_key      TEXT NOT NULL,
  subject         TEXT,
  email_count     INTEGER NOT NULL DEFAULT 0,
  senders         TEXT,   -- JSON array of email addresses
  earliest        TEXT,
  latest          TEXT,
  last_ingest_id  TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_threads_key     ON email_threads(project_id, user_id, thread_key);
CREATE        INDEX IF NOT EXISTS idx_email_threads_project ON email_threads(project_id, user_id);

-- ─── Email messages ───────────────────────────────────────────────────────────
-- Individual messages within a thread. Deduplicated by message_key.
-- message_key = sha-like hash of threadId + from + date so re-ingesting
-- the same email batch doesn't create duplicates.
CREATE TABLE IF NOT EXISTS email_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  ingest_id   TEXT NOT NULL,
  subject     TEXT,
  from_addr   TEXT,
  to_addr     TEXT,
  date        TEXT,
  body        TEXT,
  message_key TEXT,  -- dedup key: thread_key + from + date (or provided msgId)
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (thread_id) REFERENCES email_threads(id)
);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread  ON email_messages(thread_id);
-- UNIQUE on (thread_id, message_key) ensures we don't double-insert the same message
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_msg_dedup ON email_messages(thread_id, message_key);

-- ─── Email summaries ──────────────────────────────────────────────────────────
-- One summary per project+user pair, updated incrementally.
-- per_thread_json  = JSON: { [threadKey]: { summary, processedAt, actionItems? } }
-- draft_documents  = JSON array: [ { title, content } ]
CREATE TABLE IF NOT EXISTS email_summaries (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  summary_text        TEXT,
  per_thread_json     TEXT,
  last_processed_at   TEXT,
  version             INTEGER NOT NULL DEFAULT 1,
  model               TEXT,
  provider            TEXT,
  draft_documents     TEXT,
  created_at          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_summaries_project ON email_summaries(project_id, user_id);
