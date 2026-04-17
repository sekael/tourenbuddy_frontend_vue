import type { FullUserProfile } from '@/features/user/domain/entities/full-user-profile'
import type { UserProfile } from '@/features/user/domain/entities/user-profile'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { InvalidPhoneNumberError } from '@/core/exceptions'
import { useLogger } from '@/core/logging/use-logger'
import { normalizePhone, toE164 } from '@/core/utils/phone-normalize'
import { supabase } from '@/core/utils/supabase'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { UserProfileRepositoryImpl } from '@/features/user/data/repositories/user-profile-repository-impl'

const repository = new UserProfileRepositoryImpl()

export const useUserProfileStore = defineStore('userProfile', () => {
  const logger = useLogger('UserProfileStore')
  const authStore = useAuthStore()

  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /** Unified view of profile table + auth.users data. */
  const fullProfile = computed<FullUserProfile | null>(() => {
    if (!profile.value || !authStore.currentUser) return null
    return {
      id: profile.value.id,
      firstName: profile.value.firstName,
      lastName: profile.value.lastName,
      email: authStore.currentUser.email ?? '',
      phoneNumber: authStore.currentUser.phone ?? null,
      phoneVerified: authStore.currentUser.phone_confirmed_at != null,
    }
  })

  async function loadProfile() {
    const userId = authStore.currentUser?.id
    if (!userId) return

    isLoading.value = true
    error.value = null

    try {
      let fetched = await repository.getUserById(userId)

      if (!fetched) {
        fetched = await repository.upsertProfile({
          id: userId,
          firstName: null,
          lastName: null,
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

  async function updateProfile(fields: Partial<Omit<UserProfile, 'id'>>) {
    const userId = authStore.currentUser?.id
    if (!userId || !profile.value) return

    isLoading.value = true
    error.value = null

    try {
      const updated = await repository.upsertProfile({
        ...profile.value,
        ...fields,
        id: userId,
      })
      profile.value = updated
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      error.value = message
      logger.error('Failed to update user profile', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function sendPhoneVerification(phone: string) {
    const normalizeResult = normalizePhone(phone)
    if (!normalizeResult.ok) throw new InvalidPhoneNumberError()
    const e164 = toE164(normalizeResult.value)
    if (!e164) throw new InvalidPhoneNumberError()
    const { error: updateError } = await supabase.auth.updateUser({ phone: e164 })
    if (updateError) throw new Error(updateError.message)
  }

  async function verifyPhone(phone: string, token: string) {
    const e164 = toE164(phone) ?? phone
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: e164,
      token,
      type: 'phone_change',
    })
    if (verifyError) throw new Error(verifyError.message)
  }

  const sessionSkipped = ref(false)

  function skipOnboarding() {
    sessionSkipped.value = true
  }

  function clear() {
    profile.value = null
    error.value = null
    sessionSkipped.value = false
  }

  return {
    profile,
    fullProfile,
    isLoading,
    error,
    sessionSkipped,
    loadProfile,
    updateProfile,
    sendPhoneVerification,
    verifyPhone,
    skipOnboarding,
    clear,
  }
})
