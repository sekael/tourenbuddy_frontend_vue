import type { LocalPresence } from '@/features/presence/domain/entities/local-presence'
import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9A-F]{6}$/i)

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64),
  color: hexColor,
})

const cursorSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  t: z.number(),
})

const awarenessSchema = z.object({
  user: userSchema,
  cursor: z.union([cursorSchema, z.null()]).optional(),
})

/** Parse a single Awareness client state. Returns null when invalid. */
export function parseAwarenessState(raw: unknown): LocalPresence | null {
  const parsed = awarenessSchema.safeParse(raw)
  if (!parsed.success)
    return null
  const { user, cursor } = parsed.data
  return {
    user,
    cursor: cursor ?? null,
  }
}
