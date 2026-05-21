import type { UserBlock } from '@/features/friendships/data/models/user-block-schemas'

export interface UserBlockRepository {
  listActive: () => Promise<UserBlock[]>
  block: (targetUserId: string) => Promise<void>
  unblock: (targetUserId: string) => Promise<void>
  isBlockedBy: (targetUserId: string) => Promise<boolean>
  report: (targetUserId: string, reason: string | null) => Promise<void>
}
