-- 24Houring Pro sync — initial D1 schema (phase 1).
-- Apply once the D1 database exists:  npx wrangler d1 migrations apply 24houring
-- See worker/README.md and docs/pro-sync-design.md.

-- One row per OAuth identity.
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,           -- uuid
  provider     TEXT NOT NULL,              -- 'google' | 'kakao' | 'apple'
  provider_sub TEXT NOT NULL,              -- provider's stable subject id
  email        TEXT,                       -- optional (receipts / recovery)
  created_at   INTEGER NOT NULL,           -- epoch ms
  UNIQUE (provider, provider_sub)
);

-- Opaque session tokens (httpOnly cookie) with sliding expiry.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,             -- random 32B base64url
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Subscription entitlement (driven by Lemon Squeezy webhooks).
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL,        -- active|on_trial|past_due|cancelled|expired
  current_period_end INTEGER,             -- epoch ms
  ls_subscription_id TEXT,
  ls_customer_id     TEXT,
  updated_at         INTEGER NOT NULL
);

-- Synced payload: one JSON blob per user + a monotonic version for LWW.
CREATE TABLE IF NOT EXISTS sync_data (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  blob         TEXT NOT NULL,              -- JSON (content keys only; see design doc §4-1)
  version      INTEGER NOT NULL,           -- server bumps +1 on each accepted PUT
  updated_at   INTEGER NOT NULL,
  device_label TEXT                        -- last writer (conflict UX)
);
