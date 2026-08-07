import type { SupportedLocaleCode } from '@/features/user/data/models/user-profile-schema'
import type { FullUserProfile } from '@/features/user/domain/entities/full-user-profile'
import type { UserProfile } from '@/features/user/domain/entities/user-profile'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { InvalidPhoneNumberError, PhoneAlreadyRegisteredError } from '@/core/exceptions'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { isOnline } from '@/core/offline/use-online-status'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { supabase } from '@/core/utils/supabase'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
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
    if (!profile.value || !authStore.currentUser)
      return null
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
    if (!userId)
      return

    isLoading.value = true
    error.value = null

    try {
      // Hydrate from cache, then (online) refetch + overwrite (design D3). The
      // upsert-on-missing lives in the fetcher so it only runs on the online path.
      await cachedLoad(
        `profile:${userId}`,
        async () => {
          const existing = await repository.getUserById(userId)
          return existing ?? await repository.upsertProfile({
            id: userId,
            firstName: null,
            lastName: null,
            locale: null,
            onboardingTourShowAtSignIn: true,
            onboardingTourLastStep: 0,
            calendarTourShowOnFirstOpen: true,
            calendarFeatureNoticeShowAtSignIn: false,
          })
        },
        (result) => { profile.value = result },
      )

      // Reconcile locale against whatever profile we now hold (cache or fresh).
      const fetched = profile.value
      if (fetched) {
        const { useLocaleStore } = await import('@/features/i18n/presentation/stores/use-locale-store')
        const localeStore = useLocaleStore()

        if (fetched.locale !== null && fetched.locale !== localeStore.locale) {
          localeStore.setLocale(fetched.locale)
        }
        // Seed a null locale from the device — but only online (it's a DB write).
        else if (fetched.locale === null && isOnline.value) {
          const seedLocale = localeStore.locale as SupportedLocaleCode
          repository.upsertProfile({ ...fetched, locale: seedLocale }).then((updated) => {
            profile.value = updated
          }).catch(err => logger.error('Failed to seed locale on profile', err))
        }
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile'
      error.value = message
      logger.error('Failed to load user profile', err)
    }
    finally {
      isLoading.value = false
    }
  }

  // Raw profile write. NOT behind the offline seam: internal best-effort callers
  // (onboarding / calendar gate flips) persist through here and must fail silently
  // offline without surfacing a user-facing "unavailable offline" notice.
  async function persistProfile(fields: Partial<Omit<UserProfile, 'id'>>) {
    const userId = authStore.currentUser?.id
    if (!userId || !profile.value)
      return

    isLoading.value = true
    error.value = null

    try {
      const updated = await repository.upsertProfile({
        ...profile.value,
        ...fields,
        id: userId,
      })
      profile.value = updated
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      error.value = message
      logger.error('Failed to update user profile', err)
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  // User-facing profile edit: blocked + notified offline (design D5).
  async function updateProfile(fields: Partial<Omit<UserProfile, 'id'>>) {
    return mutate(() => persistProfile(fields))
  }

  async function setLocale(code: SupportedLocaleCode): Promise<void> {
    if (!profile.value || profile.value.locale === code)
      return
    try {
      await updateProfile({ locale: code })
    }
    catch {
      // updateProfile already logs; swallow to keep setLocale non-throwing
    }
  }

  async function checkPhoneAvailability(phone: string) {
    const normalizeResult = normalizePhone(phone)
    if (!normalizeResult.ok)
      throw new InvalidPhoneNumberError()
    const e164 = normalizeResult.e164

    const { data: taken } = await supabase.rpc('is_phone_registered', { p_phone: e164 })
    if (taken)
      throw new PhoneAlreadyRegisteredError()
  }

  async function sendPhoneVerification(phone: string) {
    const normalizeResult = normalizePhone(phone)
    if (!normalizeResult.ok)
      throw new InvalidPhoneNumberError()
    const e164 = normalizeResult.e164

    const { error: updateError } = await supabase.auth.updateUser({ phone: e164 })
    if (updateError) {
      if (/already|exists|registered|in use/i.test(updateError.message))
        throw new PhoneAlreadyRegisteredError()
      throw new Error(updateError.message)
    }
  }

  async function deletePhone() {
    return mutate(async () => {
      error.value = null
      const { error: rpcError } = await supabase.rpc('delete_own_phone')
      if (rpcError) {
        error.value = rpcError.message
        return
      }
      await authStore.refreshCurrentUser()
      // DB trigger removed all friendships + pending requests for this user.
      // Clear friendships store so badges and lists reflect the empty state immediately.
      useFriendshipsStore().clear()
    })
  }

  async function verifyPhone(phone: string, token: string) {
    const result = normalizePhone(phone)
    const e164 = result.ok ? result.e164 : phone
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: e164,
      token,
      type: 'phone_change',
    })
    if (verifyError)
      throw new Error(verifyError.message)
  }

  const sessionSkipped = ref(false)

  function skipOnboarding() {
    sessionSkipped.value = true
  }

  /**
   * Flip the auto-start gate off once the onboarding tour is first shown at
   * sign-in. Non-blocking: a failure just means the tour may auto-show again
   * next mount, which is acceptable.
   */
  async function dismissTourAtSignIn() {
    try {
      await persistProfile({ onboardingTourShowAtSignIn: false })
    }
    catch (err) {
      logger.error('Failed to dismiss onboarding tour auto-start', err)
    }
  }

  /** Persist the onboarding tour resume index. Non-blocking. */
  async function saveTourStep(n: number) {
    try {
      await persistProfile({ onboardingTourLastStep: n })
    }
    catch (err) {
      logger.error('Failed to persist onboarding tour step', err)
    }
  }

  /**
   * Flip the calendar-tour auto-show gate off once it has first been shown
   * (auto-chain from the map tour OR standalone first calendar open). Non-blocking,
   * mirroring dismissTourAtSignIn.
   */
  async function dismissCalendarTour() {
    try {
      await persistProfile({ calendarTourShowOnFirstOpen: false })
    }
    catch (err) {
      logger.error('Failed to dismiss calendar tour auto-show', err)
    }
  }

  /** Flip only the legacy calendar-feature notice gate; leave the calendar tour gate intact. */
  async function dismissCalendarFeatureNotice() {
    try {
      await persistProfile({ calendarFeatureNoticeShowAtSignIn: false })
    }
    catch (err) {
      logger.error('Failed to dismiss calendar feature notice', err)
    }
  }

  function clear() {
    profile.value = null
    error.value = null
    sessionSkipped.value = false
  }

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && uid ? `user-profile-${uid}` : null
  })
  const realtimeEnabled = computed(() => authStore.isAuthenticated)

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => realtimeEnabled.value,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      // user_profile PK id IS the auth uid — filter by id, not user_id
      return [{ event: '*', table: 'user_profile', filter: `id=eq.${uid}` }]
    },
    onChange: loadProfile,
    onSubscribed: () => loadProfile(),
  })

  watch(
    () => authStore.isAuthenticated,
    (v) => {
      if (!v)
        clear()
    },
  )

  return {
    profile,
    fullProfile,
    isLoading,
    error,
    sessionSkipped,
    loadProfile,
    updateProfile,
    setLocale,
    checkPhoneAvailability,
    sendPhoneVerification,
    verifyPhone,
    deletePhone,
    skipOnboarding,
    dismissTourAtSignIn,
    saveTourStep,
    dismissCalendarTour,
    dismissCalendarFeatureNotice,
    clear,
  }
})
