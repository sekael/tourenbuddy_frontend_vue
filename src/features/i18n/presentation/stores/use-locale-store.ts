import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n } from '@/core/i18n'
import { writePersistedLocale } from '@/core/i18n/persistence'
import { SUPPORTED_LOCALE_CODES } from '@/core/i18n/supported'
import { toEmailLocale } from '@/core/i18n/to-email-locale'
import { useLogger } from '@/core/logging/use-logger'
import { supabase } from '@/core/utils/supabase'

export const useLocaleStore = defineStore('locale', () => {
  const logger = useLogger('LocaleStore')
  const locale = ref(i18n.global.locale.value as string)

  function setLocale(code: string): void {
    if (!SUPPORTED_LOCALE_CODES.includes(code)) {
      logger.warn(`Unsupported locale "${code}" — ignoring`)
      return
    }
    locale.value = code
    ;(i18n.global.locale as { value: string }).value = code
    writePersistedLocale(code)
    document.documentElement.lang = code

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase.auth.updateUser({ data: { locale: toEmailLocale(code) } }).then(({ error }) => {
          if (error)
            logger.error('Failed to sync locale to user metadata', error)
        })
      }
    })
  }

  return { locale, setLocale }
})
