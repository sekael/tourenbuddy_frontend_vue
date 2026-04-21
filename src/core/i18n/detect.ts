import { SUPPORTED_LOCALE_CODES } from './supported'

export function detectLocale(): string {
  const languages = navigator.languages ?? [navigator.language]

  for (const lang of languages) {
    if (SUPPORTED_LOCALE_CODES.includes(lang))
      return lang

    const base = lang.split('-')[0]
    const match = SUPPORTED_LOCALE_CODES.find(code => code.split('-')[0] === base)
    if (match)
      return match
  }

  return 'en'
}
