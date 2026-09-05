-- 24Houring — Android home-screen widget images (one row per connected phone).
-- Apply:  npx wrangler d1 execute 24houring --remote --file worker/migrations/0007_widgets.sql
--
-- Unlike shares (immutable, one per link) a widget row is a SLOT the phone's
-- token addresses: the web app overwrites it whenever the timetable changes, and
-- the widget re-fetches it (ETag) on its own schedule. Storage stays bounded at
-- one image per phone no matter how often the timetable is edited.
CREATE TABLE IF NOT EXISTS widgets (
  token       TEXT PRIMARY KEY,          -- client-generated secret (22 base62 chars)
  png         BLOB NOT NULL,             -- transparent 1080x1080 ring, rendered by the app
  meta        TEXT NOT NULL DEFAULT '{}',-- JSON ring geometry (px) + view window for the native now-hand
  etag        TEXT NOT NULL,             -- hash of the png; lets the widget skip unchanged downloads
  ip_hash     TEXT NOT NULL DEFAULT '',  -- salted hash of creator IP (creation rate limit only)
  win_start   INTEGER NOT NULL DEFAULT 0,-- per-token upload rate-limit window
  win_count   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_widgets_ip_time ON widgets (ip_hash, created_at);
