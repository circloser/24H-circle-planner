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
3. **Set secrets** (phases 2–4): `npx wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `KAKAO_*` / `APPLE_*` / `LS_WEBHOOK_SECRET` / `SESSION_PEPPER`.
4. Implement auth (`/api/auth/*`, `/api/me`), then sync (`/api/sync`), then billing
   (`/api/checkout`, `/api/webhooks/lemonsqueezy`) per the design doc roadmap.

> Deploy is Cloudflare Workers Builds (pnpm 10.11.1). To add deps use
> `npx pnpm@10.11.1 add <pkg>` (see project memory: cloudflare-deploy).
