import { describe, expect, it } from 'vitest'
import { currentReleaseNote, RELEASE_NOTES } from '@/features/notifications/data/release-notes'
import deCH from '@/locales/de-CH.json'
import en from '@/locales/en.json'

describe('release notes registry', () => {
  it('should have no current note when the registry is empty', () => {
    expect(currentReleaseNote([])).toBeNull()
  })

  it('should treat the last entry as current, regardless of id order', () => {
    expect(currentReleaseNote([{ id: 'zz', since: '2026-01-01' }, { id: 'aa', since: '2026-02-01' }])?.id).toBe('aa')
  })

  it('should only hold unique ids the RPC accepts, each with a date and copy in every locale', () => {
    const ids = RELEASE_NOTES.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const note of RELEASE_NOTES) {
      expect(note.id).toMatch(/^[a-z0-9-]{1,64}$/)
      expect(note.since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const locale of [en, deCH] as Array<{ releaseNotes: Record<string, { title?: string, body?: string }> }>) {
        expect(locale.releaseNotes[note.id]?.title).toBeTruthy()
        expect(locale.releaseNotes[note.id]?.body).toBeTruthy()
      }
    }
  })
})
