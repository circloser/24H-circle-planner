-- 24Houring Pro — Web Push alarms (closed-tab slice-start notifications).
-- Apply:  npx wrangler d1 execute 24houring --remote --file worker/migrations/0004_push.sql
--
-- The client precomputes TODAY'S notification texts (title/body per boundary)
-- and uploads them as a plan, so the server never needs to parse schedules
-- (and E2EE sync stays opaque — enabling push is an explicit opt-in that
-- shares only the notification strings). A minute cron matches each user's
-- local HH:MM against the plan and pushes to every registered device.

-- One row per device push subscription (a user can have several devices).
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint   TEXT PRIMARY KEY,             -- push service URL (unique per device)
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh     TEXT NOT NULL,                -- client ECDH public key (b64url)
  auth       TEXT NOT NULL,                -- client auth secret (b64url)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subs(user_id);

-- One plan per user: the boundaries to notify (client-rendered strings).
CREATE TABLE IF NOT EXISTS push_plans (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  boundaries TEXT NOT NULL,                -- JSON [{t:'HH:MM', title, body}]
  tz_offset  INTEGER NOT NULL,             -- minutes east of UTC (KST=540)
  last_fired TEXT,                         -- 'YYYY-MM-DD|HH:MM' dedupe (local)
  updated_at INTEGER NOT NULL
);
