# Environment & CI/CD

## CI

- **PR checks** (`analyze-and-test.yml`): lint → type-check → vitest
- **PR build smoke** (`test-build-web.yml`): build only, no deploy
- **PR preview deploy** (`deploy-preview.yml`): build + deploy to `https://<branch-slug>.tourenbuddy.pages.dev` on every PR to `main`. Posts/updates sticky comment with preview URL. Skipped for forked PRs. Branch slug is lowercased, sanitized to `[a-z0-9-]`, capped at 28 chars.
- **PR preview cleanup** (`cleanup-preview.yml`): on PR close (merged or not), deletes all preview deployments associated with the branch slug via the Cloudflare API, keeping the Pages deployments list tidy.
- **Release** (`release.yml`): release-please auto-versions on merge to `main`
- **Deploy** (`build-web-and-push.yml`): build → Cloudflare Pages `main` branch (triggered by release-please)
- CI creates dummy `.env` — real env never committed

> Cloudflare Pages dashboard env vars are **not** read by this pipeline — the build step in GitHub Actions writes `.env` from repo secrets, then uploads the prebuilt `dist/`. Add new `VITE_*` vars to BOTH the workflow `Create Env File` step AND the GitHub Actions repo secrets.

## Environment Variables

All client vars need `VITE_` prefix. Validated at startup via Zod in `core/constants/env.ts`:

**Required:**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous (publishable) key

**Notifications (optional, gated by `VITE_NOTIFICATIONS_ENABLED`):**
- `VITE_VAPID_PUBLIC_KEY` — Web Push VAPID public key. MUST match Worker's `VAPID_PUBLIC_KEY` secret.
- `VITE_NOTIFY_HOOK_URL` — `services/email-hook` Worker URL (e.g. `https://tourenbuddy-email-hook.<account>.workers.dev`)
- `VITE_NOTIFICATIONS_ENABLED` — `true` to enable dispatch; absent / `false` short-circuits client-side.

Access via `env` object from `core/constants/env.ts`, never `import.meta.env` directly in feature code.

## GitHub Actions secrets

Set at **repo → Settings → Secrets and variables → Actions**:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — Supabase prod values (written into `.env` as `VITE_*`)
- `VAPID_PUBLIC_KEY` — VAPID publicKey (frontend; same value as Worker secret)
- `NOTIFY_HOOK_URL` — Worker URL
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — for `wrangler pages deploy`

## Worker (`services/email-hook`)

Separate deploy via `wrangler deploy` (manual). Worker secrets use **plain names, no `VITE_` prefix** (Workers env model — Vite prefix has no meaning server-side). See `services/email-hook/SETUP-NOTIFICATIONS.md` for the full list and `wrangler secret put` flow.
