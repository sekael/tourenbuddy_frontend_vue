import type { InboxNotification } from '../domain/entities/inbox-notification'

/** Every action the DB emits today (design D1). Actions are unique across types. */
export const INBOX_ACTIONS = [
  'received',
  'responded',
  'created',
  'updated',
  'deleted',
  'collision',
  'backfill',
  'link_created',
  'link_declined',
  'group_joined',
  'group_evicted_external',
  'group_dissolved',
  'suggestion_submitted',
  'suggestion_revised',
  'suggestion_resolved',
] as const

const KNOWN = new Set<string>(INBOX_ACTIONS)

/**
 * Entries store structure, not prose, so they re-render in the current locale (D1). An
 * action this build doesn't know (a newer DB) falls back to a generic line.
 */
export function inboxText(
  entry: InboxNotification,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const key = KNOWN.has(entry.action) ? `inbox.entry.${entry.action}` : 'inbox.entry.unknown'
  return t(key, {
    actor: entry.actorName || t('inbox.someone'),
    tour: entry.tourName || t('inbox.aTour'),
    count: typeof entry.ref.count === 'number' ? entry.ref.count : entry.occurrences,
  })
}
