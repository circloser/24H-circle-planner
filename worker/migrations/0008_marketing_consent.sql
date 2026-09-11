-- 24Houring — news-email consent (the only lawful source of a mailing list).
-- Apply:  npx wrangler d1 execute 24houring --remote --file worker/migrations/0008_marketing_consent.sql
--
-- Google sign-in stores an email for two stated purposes (session, subscription
-- check). Emailing news to it needs a SEPARATE explicit opt-in, recorded here.
-- One row per user who has answered; no row = never asked or never answered,
-- which counts as "no". Rows are never backfilled.
CREATE TABLE IF NOT EXISTS marketing_consent (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  opted_in     INTEGER NOT NULL,          -- 1 agreed · 0 declined or withdrawn
  version      TEXT NOT NULL,             -- which consent notice this choice answered
  decided_at   INTEGER NOT NULL,          -- epoch ms of the current choice (proof of consent)
  unsub_token  TEXT NOT NULL UNIQUE,      -- one-click unsubscribe secret; survives re-consent
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketing_opted ON marketing_consent (opted_in, decided_at);
