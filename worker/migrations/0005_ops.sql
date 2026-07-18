-- 24Houring — tiny operator state (admin ops notifications).
-- Apply:  npx wrangler d1 execute 24houring --remote --file worker/migrations/0005_ops.sql
CREATE TABLE IF NOT EXISTS ops_state (
  key   TEXT PRIMARY KEY,
  value TEXT
);
