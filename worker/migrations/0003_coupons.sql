-- 24Houring Pro — coupon codes + coupon-granted entitlements.
-- Apply:  npx wrangler d1 migrations apply 24houring --remote
--
-- Entitlement (see handleMe) becomes: admin allowlist OR active Polar
-- subscription OR an active coupon grant. Grants live in their own table so
-- redeeming a coupon never clobbers a user's Polar `subscriptions` row.

-- Redeemable codes issued by the admin.
CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,      -- stored UPPERCASE
  grant_days  INTEGER,               -- days of Pro granted per redemption; NULL/0 = permanent
  max_uses    INTEGER,               -- total redemptions allowed across users; NULL = unlimited
  used_count  INTEGER NOT NULL DEFAULT 0,
  note        TEXT,                  -- admin label (e.g. "런칭 프로모")
  created_at  INTEGER NOT NULL,      -- epoch ms
  expires_at  INTEGER                -- code no longer redeemable after this epoch ms; NULL = never
);

-- One Pro entitlement per (user, coupon). Separate from `subscriptions`.
CREATE TABLE IF NOT EXISTS grants (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,         -- the redeemed coupon code
  expires_at  INTEGER,               -- entitlement expiry (epoch ms); NULL = permanent
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, code)        -- a code can be redeemed at most once per user
);
CREATE INDEX IF NOT EXISTS idx_grants_user ON grants(user_id);
