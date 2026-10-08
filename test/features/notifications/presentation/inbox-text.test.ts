import { describe, expect, it } from 'vitest'
import { INBOX_ACTIONS } from '@/features/notifications/presentation/inbox-text'
import deCH from '@/locales/de-CH.json'
import en from '@/locales/en.json'

describe('inbox text', () => {
  it.each([['en', en], ['de-CH', deCH]])('should have a %s string for every emitted action', (_, locale) => {
    const entries = (locale as { inbox: { entry: Record<string, string> } }).inbox.entry
    const missing = [...INBOX_ACTIONS, 'unknown'].filter(a => !entries[a])
    expect(missing).toEqual([])
  })
})
