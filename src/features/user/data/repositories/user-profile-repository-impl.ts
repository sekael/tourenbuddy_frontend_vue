import type { UserProfile } from '@/features/user/domain/entities/user-profile'
import type { UserProfileRepository } from '@/features/user/domain/repositories/user-profile-repository'
import { UnauthorizedUserException } from '@/core/exceptions'
import { supabase } from '@/core/utils/supabase'
import { userProfileRowSchema } from '@/features/user/data/models/user-profile-schema'

export class UserProfileRepositoryImpl implements UserProfileRepository {
  async getUserById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error)
      throw new Error(error.message)
    if (!data)
      return null

    return userProfileRowSchema.parse(data)
  }

  async upsertProfile(profile: UserProfile): Promise<UserProfile> {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentUserId = sessionData.session?.user.id

    if (currentUserId !== profile.id) {
      throw new UnauthorizedUserException()
    }

    const { data, error } = await supabase
      .from('user_profile')
      .upsert({
        id: profile.id,
        first_name: profile.firstName,
        last_name: profile.lastName,
      })
      .select()
      .single()

    if (error)
      throw new Error(error.message)

    return userProfileRowSchema.parse(data)
  }
}
