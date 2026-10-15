/**
 * Release notes bundled with the app (design D6). Copy lives in i18n under
 * `releaseNotes.<id>.{title,intro}` and `releaseNotes.<id>.features.<key>.{title,body}`,
 * and never names a version. Structure (icons, the optional settings shortcut) lives here.
 *
 * - `id`: unique, chosen when writing the note; must match `^[a-z0-9-]{1,64}$` (the RPC
 *   rejects anything else). Ids only need to differ — no ordering, no semver.
 * - `since`: the authoring date (YYYY-MM-DD); accounts created later never get the note.
 * - The CURRENT note is the LAST entry. Append; NEVER remove an entry — inbox rows keep
 *   pointing at old ids, and a missing one renders "no longer available".
 */
export interface ReleaseNote {
  id: string
  since: string
  /** One row per highlight: `key` picks the i18n copy, `icon` a BaseIcon registry name. */
  features: readonly { key: string, icon: string }[]
  /** Shortcut button under the highlights; omit when the note needs no follow-up. */
  action?: 'notification-settings'
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-10-availability-reminders',
    since: '2026-10-12',
    features: [
      { key: 'availability', icon: 'event_available' },
      { key: 'reminders', icon: 'schedule' },
    ],
    action: 'notification-settings',
  },
  {
    id: '2026-10-trail-overlays',
    since: '2026-10-15',
    features: [
      { key: 'hiking', icon: 'hiking' },
      { key: 'ski', icon: 'downhill_skiing' },
      { key: 'details', icon: 'info' },
    ],
  },
]

export function currentReleaseNote(notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote | null {
  return notes.at(-1) ?? null
}

export function findReleaseNote(id: unknown): ReleaseNote | null {
  return RELEASE_NOTES.find(n => n.id === id) ?? null
}
