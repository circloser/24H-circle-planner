-- 24Houring Pro — switch billing to Polar (Merchant of Record).
-- Adds Polar identifiers to the existing `subscriptions` table. The legacy
-- ls_* columns stay (nullable, unused) to avoid a destructive rewrite.
-- Apply:  npx wrangler d1 migrations apply 24houring

ALTER TABLE subscriptions ADD COLUMN polar_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN polar_customer_id TEXT;
