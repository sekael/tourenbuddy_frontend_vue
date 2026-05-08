import { z } from 'zod'

// Treat empty strings the same as missing — env files with empty values
// (e.g. unset CI secrets that still echo `KEY=` lines) should not fail validation.
const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v)

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_VAPID_PUBLIC_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  VITE_NOTIFY_HOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  VITE_NOTIFICATIONS_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
})

/** Validated environment variables. Use this instead of `import.meta.env` directly. */
export const env = envSchema.parse(import.meta.env)
