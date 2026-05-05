-- SourceDesk migration 002 — Hindsight per-user settings
-- Compatible with both SQLite and PostgreSQL.
-- Applied automatically on server startup via db.runMigrations().
--
-- No FOREIGN KEY on user_id: the Hindsight bank is managed by the external
-- Hindsight service and the users table may not be populated in all deployments.

-- ─── User Hindsight settings ──────────────────────────────────────────────────
-- One row per user; bank_id mirrors user_id in the current single-bank model.
-- enabled = 0 lets an admin or the user turn off memory retention without
-- deleting the bank on the Hindsight side.
CREATE TABLE IF NOT EXISTS user_hindsight (
  user_id    TEXT PRIMARY KEY,
  bank_id    TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
