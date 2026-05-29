-- Cloudflare D1 schema for fakekalobby logs (external persistent storage).
-- Apply with:
--   wrangler d1 execute fakekalobby-db --remote --file=./schema.sql
CREATE TABLE IF NOT EXISTS threads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  replies      TEXT    NOT NULL DEFAULT '[]',
  isPublic     INTEGER NOT NULL DEFAULT 0,
  isSafetyMode INTEGER NOT NULL DEFAULT 0,
  isSensitive  INTEGER NOT NULL DEFAULT 0,
  createdAt    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_threads_public ON threads (isPublic, id DESC);
