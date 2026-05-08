import type { User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toEmailLocale } from '@/core/i18n/to-email-locale'
import { useLogger } from '@/core/logging/use-logger'
import { supabase } from '@/core/utils/supabase'
import { useLocaleStore } from '@/features/i18n/presentation/stores/use-locale-store'

export const useAuthStore = defineStore('auth', () => {
  const logger = useLogger('AuthStore')

  const currentUser = ref<User | null>(null)
  const isLoading = ref(true)

  const isAuthenticated = computed(() => currentUser.value !== null)

  /** Initialize auth state from existing session and subscribe to changes. */
  async function initialize() {
    const { data } = await supabase.auth.getSession()
    currentUser.value = data.session?.user ?? null
    isLoading.value = false

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser.value = session?.user ?? null
      logger.debug('Auth state changed', { event: _event, userId: session?.user?.id })
    })
  }

  async function sendEmailOtp(email: string) {
    const localeStore = useLocaleStore()
    const emailLocale = toEmailLocale(localeStore.locale)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { locale: emailLocale },
      },
    })
    if (error)
      throw error
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error)
      throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error)
      throw error
    currentUser.value = null
  }

  return {
    currentUser,
    isLoading,
    isAuthenticated,
    initialize,
    sendEmailOtp,
    verifyOtp,
    signOut,
  }
})
