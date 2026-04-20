const LOCALE_KEY = 'tb.locale'

export function readPersistedLocale(): string | null {
  return localStorage.getItem(LOCALE_KEY)
}

export function writePersistedLocale(code: string): void {
  localStorage.setItem(LOCALE_KEY, code)
}
