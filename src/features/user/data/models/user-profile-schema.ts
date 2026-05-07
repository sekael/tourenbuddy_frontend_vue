import { z } from 'zod'

export const supportedLocaleCodeSchema = z.enum(['en', 'de-CH'])
export type SupportedLocaleCode = z.infer<typeof supportedLocaleCodeSchema>

/** Zod schema for a user profile row from the `user_profile` Supabase table. */
export const userProfileSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  locale: supportedLocaleCodeSchema.nullable(),
})

/** Raw shape returned from Supabase (snake_case). */
export const userProfileRowSchema = z
  .object({
    id: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    locale: supportedLocaleCodeSchema.nullish().transform(v => v ?? null),
  })
  .transform(row => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    locale: row.locale,
  }))
