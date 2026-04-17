# Environment & CI/CD

## CI

- **PR checks** (`analyze-and-test.yml`): lint → type-check → vitest
- **Release** (`release.yml`): release-please auto-versions on merge to `main`
- **Deploy** (`build-web-and-push.yml`): build → Cloudflare Pages
- CI creates dummy `.env` — real env never committed

## Environment Variables

All client vars need `VITE_` prefix. Validated at startup via Zod in `core/constants/env.ts`:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

Access via `env` object, never `import.meta.env` directly in feature code.
