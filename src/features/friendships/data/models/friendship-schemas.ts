import { z } from 'zod'

export const friendRequestSchema = z.object({
  id: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  status: z.enum(['pending', 'accepted', 'denied', 'cancelled']),
  createdAt: z.string(),
  respondedAt: z.string().nullable(),
})

export const friendshipSchema = z.object({
  userAId: z.string().uuid(),
  userBId: z.string().uuid(),
  createdAt: z.string(),
  requestId: z.string().uuid().nullable(),
})

export type FriendRequest = z.infer<typeof friendRequestSchema>
export type Friendship = z.infer<typeof friendshipSchema>
