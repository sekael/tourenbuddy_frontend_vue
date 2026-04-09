import { z } from 'zod'

/** Raw shape from Supabase `tours_view` (snake_case). */
export const tourRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    planned_date: z.string().nullable(),
    lon: z.number(),
    lat: z.number(),
    name: z.string().nullable(),
    partner_ids: z.array(z.string()).default([]),
  })
  .transform(row => ({
    id: row.id,
    userId: row.user_id,
    plannedDate: row.planned_date ? new Date(row.planned_date) : null,
    goal: { lng: row.lon, lat: row.lat },
    name: row.name,
    partnerIds: row.partner_ids,
  }))

/** Domain-level tour shape. */
export const tourSchema = z.object({
  id: z.string(),
  userId: z.string(),
  plannedDate: z.coerce.date().nullable(),
  goal: z.object({ lng: z.number(), lat: z.number() }),
  name: z.string().nullable(),
  partnerIds: z.array(z.string()),
})
