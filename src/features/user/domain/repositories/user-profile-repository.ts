import type { UserProfile } from '@/features/user/domain/entities/user-profile'

/** Abstract repository interface for user profile data operations. */
export interface UserProfileRepository {
  getUserById: (userId: string) => Promise<UserProfile | null>
  upsertProfile: (profile: UserProfile) => Promise<UserProfile>
}
