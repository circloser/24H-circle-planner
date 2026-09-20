-- 자서전 (worker/memoir.ts): one purchase buys one memoir.
-- The Worker also creates these lazily (CREATE TABLE IF NOT EXISTS), so the
-- feature works before this migration is applied; it is here so the schema is
-- readable in one place.

-- Credits waiting to be spent, per account and kind ('memoir').
CREATE TABLE IF NOT EXISTS ai_credits (
  user_id    TEXT    NOT NULL,
  kind       TEXT    NOT NULL,
  credits    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
);

-- Orders already counted. Polar retries its webhooks, and one order must never
-- be worth two memoirs.
CREATE TABLE IF NOT EXISTS ai_orders (
  order_id   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
