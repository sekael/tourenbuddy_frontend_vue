import type { UserProfile } from '@/features/user/domain/entities/user-profile'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { UserProfileRepositoryImpl } from '@/features/user/data/repositories/user-profile-repository-impl'

const repository = new UserProfileRepositoryImpl()

export const useUserProfileStore = defineStore('userProfile', () => {
  const logger = useLogger('UserProfileStore')
  const authStore = useAuthStore()

  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadProfile() {
    const userId = authStore.currentUser?.id
    if (!userId) return

    isLoading.value = true
    error.value = null

    try {
      let fetched = await repository.getUserById(userId)

      if (!fetched) {
        // Create minimal profile on first login
        fetched = await repository.upsertProfile({
          id: userId,
          firstName: null,
          lastName: null,
          dateOfBirth: null,
        })
      }

      profile.value = fetched
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile'
      error.value = message
      logger.error('Failed to load user profile', err)
    } finally {
      isLoading.value = false
    }
  }

  function clear() {
    profile.value = null
    error.value = null
  }

  return { profile, isLoading, error, loadProfile, clear }
})
