import type { MessageSchema } from '@/types/vue-i18n'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import deChMessages from '@/locales/de-CH.json'
import enMessages from '@/locales/en.json'
import { detectLocale } from './detect'
import { readPersistedLocale } from './persistence'

const locale = readPersistedLocale() ?? detectLocale()

// The third generic is `Legacy`. It defaults to `true`, and supplying the first two
// explicitly stops TS inferring `legacy: false` from the options object — so without
// it `i18n.global` is typed as the legacy `VueI18n` and `locale` as a plain string.
export const i18n = createI18n<[MessageSchema], 'en' | 'de-CH', false>({
  legacy: false,
  globalInjection: false,
  locale,
  fallbackLocale: 'en',
  messages: {
    'en': enMessages as MessageSchema,
    'de-CH': deChMessages as MessageSchema,
  },
})

export function setupI18nLocaleWatcher(): void {
  watch(i18n.global.locale, () => {
    import('./zod-error-map').then(({ installZodErrorMap }) => installZodErrorMap())
  })
}
