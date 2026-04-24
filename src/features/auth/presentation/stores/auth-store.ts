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

  async function sendMagicLink(email: string) {
    const localeStore = useLocaleStore()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { locale: toEmailLocale(localeStore.locale) },
      },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    currentUser.value = null
  }

  return {
    currentUser,
    isLoading,
    isAuthenticated,
    initialize,
    sendMagicLink,
    signOut,
  }
})
