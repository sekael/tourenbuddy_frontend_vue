import { z } from 'zod'

/** Zod schema for a user profile row from the `user_profile` Supabase table. */
export const userProfileSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
})

/** Raw shape returned from Supabase (snake_case). */
export const userProfileRowSchema = z
  .object({
    id: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
  }))
