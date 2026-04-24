export function toEmailLocale(code: string): 'en' | 'de' {
  if (code === 'de' || code.startsWith('de-')) return 'de'
  return 'en'
}
