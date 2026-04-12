import { z } from 'zod'

/** Raw shape from Supabase `contacts` table (snake_case). */
export const contactRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    first_name: z.string(),
    last_name: z.string().nullable(),
    display_name: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
  }))

/** Domain-level contact shape (camelCase). */
export const contactSchema = z.object({
  id: z.string(),
  userId: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(),
})
