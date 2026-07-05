# 24Houring API Worker

Backend foundation for Pro cross-device sync. Full design: [`docs/pro-sync-design.md`](../docs/pro-sync-design.md).

## What ships in phase 1 (this commit)
- `index.ts` — a Worker that handles `/api/*` and falls through to the static SPA
  via the `ASSETS` binding. App behaviour is unchanged.
- `GET /api/health` → `{ ok: true }` (liveness probe — confirms the Worker is live).
- All other `/api/*` routes return `501 not_implemented` until later phases.
- `migrations/0001_init.sql` — the D1 schema (not applied yet; needs the DB).

`wrangler.jsonc` now sets `main: "worker/index.ts"` + `assets.binding: "ASSETS"`,
so the deploy model is **Worker + static assets** (was assets-only). No D1 binding
yet — it's added only after the database exists (next step), so deploys don't fail
on a missing binding.

## Verify before deploy (no Cloudflare auth needed)
```bash
npx wrangler deploy --dry-run     # bundles the Worker + validates wrangler.jsonc
pnpm run build                     # SPA build unchanged
```

## Next steps — require the Cloudflare account (operator)
1. **Create D1** and copy the id into `wrangler.jsonc`:
   ```bash
   npx wrangler d1 create 24houring
   ```
   ```jsonc
   // wrangler.jsonc
   "d1_databases": [
     { "binding": "DB", "database_name": "24houring", "database_id": "<id>", "migrations_dir": "worker/migrations" }
   ]
   ```
   Then uncomment `DB: D1Database` in `index.ts` `Env`.
2. **Apply the schema:** `npx wrangler d1 migrations apply 24houring` (and `--remote` for prod).
3. **Set secrets:** `npx wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   for auth, and for billing (Polar): `POLAR_ACCESS_TOKEN` (Organization Access Token)
   + `POLAR_WEBHOOK_SECRET` (the `polar_whs_…` from the webhook config). Non-secret
   Polar config (`POLAR_SERVER=sandbox`, `POLAR_PRODUCT_ID`) lives in `wrangler.jsonc` `vars`.
4. Auth (`/api/auth/*`, `/api/me`) and sync (`/api/sync`) are live. Billing is Polar
   (Merchant of Record) in **sandbox**:
   - `POST /api/checkout` → creates a Polar checkout session → `{ url }` (hosted checkout).
   - `POST /api/billing/portal` → mints a customer session → `{ url }` (manage/cancel).
   - `POST /api/webhooks/polar` → Standard-Webhooks-verified; `subscription.*` events
     upsert the `subscriptions` row (mapped via `external_customer_id` = our user id).
   In the Polar sandbox dashboard, point the webhook at `https://24houring.com/api/webhooks/polar`
   and subscribe to the `subscription.*` events. Flip `POLAR_SERVER` to `production`
   (and swap to a production token/secret/product) to go live.

> Deploy is Cloudflare Workers Builds (pnpm 10.11.1). To add deps use
> `npx pnpm@10.11.1 add <pkg>` (see project memory: cloudflare-deploy).
