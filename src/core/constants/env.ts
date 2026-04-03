import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

/** Validated environment variables. Use this instead of `import.meta.env` directly. */
export const env = envSchema.parse(import.meta.env)
