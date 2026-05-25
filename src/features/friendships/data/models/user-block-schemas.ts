import { z } from 'zod'

export const userBlockSchema = z.object({
  blockerUserId: z.string().uuid(),
  blockedUserId: z.string().uuid(),
  firstBlockedAt: z.string(),
  lastBlockedAt: z.string(),
  unblockedAt: z.string().nullable(),
})

export type UserBlock = z.infer<typeof userBlockSchema>
