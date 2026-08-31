-- 24Houring — server-stored share links (/s/:id) with OG unfurl images.
-- Apply:  npx wrangler d1 execute 24houring --remote --file worker/migrations/0006_shares.sql
CREATE TABLE IF NOT EXISTS shares (
  id         TEXT PRIMARY KEY,          -- short public id (10 chars, base62)
  payload    TEXT NOT NULL,             -- the b64url share code (same format as /s#d=)
  name       TEXT NOT NULL DEFAULT '',  -- schedule name for og:title
  og_png     BLOB,                      -- 1200x630 unfurl PNG rendered by the sharing client
  ip_hash    TEXT NOT NULL DEFAULT '',  -- salted hash of creator IP (rate limiting only)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_ip_time ON shares (ip_hash, created_at);
