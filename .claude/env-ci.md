## CI/CD Pipeline

- **PR checks** (`analyze-and-test.yml`): lint → type check → `vitest run` → Playwright (if configured)
- **Release** (`release.yml`): release-please auto-versions on merge to `main`
- **Deploy** (`build-web-and-push.yml`): builds Vue app, deploys to Cloudflare Pages
- CI creates dummy `.env` — real env file not committed

## Environment Variables

- All client-exposed variables MUST use `VITE_` prefix (Vite requirement)
- Required variables:
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- Validate env vars at app startup using Zod:

  ```ts
  import { z } from 'zod'

  const envSchema = z.object({
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
  })
  export const env = envSchema.parse(import.meta.env)
  ```

- Never commit `.env` files — use `.env.example` with placeholder values
- Access validated env via `env` object, never `import.meta.env` directly in feature code

