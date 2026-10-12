import type { InboxNotification, InboxStaleReason } from '../../domain/entities/inbox-notification'
import type { InboxRepository } from '../../domain/repositories/inbox-repository'
import type { WriteQueueEntry } from '@/core/offline/write-queue'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { flushThenRefetch } from '@/core/offline/reconnect'
import { registerReplay } from '@/core/offline/replay'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { InboxRepositoryImpl } from '../../data/repositories/inbox-repository-impl'

export const INBOX_PAGE_SIZE = 20
/** Unread fetch cap. The badge shows `9+` past 9, so counting further buys nothing. */
const UNREAD_CAP = 99
const ALL_KEY_PREFIX = 'inbox-all:'
/** Own key, not ALL_KEY_PREFIX: a queued clear must not coalesce into a queued mark-all. */
const CLEAR_KEY_PREFIX = 'inbox-clear:'

/** Actions whose subject is a pending request/batch that can be resolved elsewhere. */
const PENDING_SUBJECT: Record<string, 'friend' | 'batch' | 'link'> = {
  received: 'friend',
  suggestion_submitted: 'batch',
  suggestion_revised: 'batch',
  link_created: 'link',
}

const repository: InboxRepository = new InboxRepositoryImpl()

/**
 * Whether a source store has demonstrably loaded: it holds data, or a load was seen to
 * finish. Until then, "missing from the source" proves nothing — staleness would flash
 * on every cold start.
 */
function loadedOnce(isLoading: () => boolean, hasData: () => boolean) {
  const seen = ref(false)
  watch(isLoading, (now, before) => {
    if (before && !now)
      seen.value = true
  })
  return computed(() => seen.value || hasData())
}

export const useInboxStore = defineStore('inbox', () => {
  const logger = useLogger('InboxStore')
  const authStore = useAuthStore()
  const friendshipsStore = useFriendshipsStore()
  const toursStore = useToursStore()
  const suggestionsStore = useTourSuggestionsStore()
  const linksStore = useTourLinksStore()

  /** Merged set: the loaded pages ∪ every unread entry (D7). */
  const entries = ref<InboxNotification[]>([])
  const hasMore = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Keyset cursor: oldest `createdAt` among loaded PAGE rows (unread extras don't move it). */
  let cursor: string | null = null

  const uid = computed(() => authStore.currentUser?.id ?? null)
  const cacheKey = () => `inbox:${uid.value}`

  const sorted = computed(() =>
    [...entries.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  // ── staleness (derived, never stored) ──────────────────────────────────────
  const friendsReady = loadedOnce(() => friendshipsStore.isLoading, () => friendshipsStore.incomingRequests.length > 0)
  const toursReady = loadedOnce(() => toursStore.isLoading, () => toursStore.tours.length + toursStore.friendTours.length > 0)
  const batchesReady = loadedOnce(() => suggestionsStore.loading, () => suggestionsStore.suggestions.length > 0)
  const linksReady = loadedOnce(() => linksStore.loading, () => linksStore.pendingRequests.length > 0)

  const pendingFriendRequestIds = computed(() => new Set(
    friendshipsStore.incomingRequests.filter(r => r.status === 'pending').map(r => r.id),
  ))
  const pendingBatchIds = computed(() => new Set(
    suggestionsStore.suggestions.filter(s => s.status === 'pending').map(s => s.batchId),
  ))
  const pendingLinkIds = computed(() => new Set(
    linksStore.pendingRequests.filter(r => r.status === 'pending').map(r => r.id),
  ))
  // What an entry may open: the user's own tours and friend tours they are a partner on
  // NOW. A non-partner friend tour is readable from the Friends list, but an entry must
  // not reopen a tour after its recipient was removed from it (nor one gone private —
  // RLS drops that from friendTours entirely).
  const openableTourIds = computed(() => new Set([
    ...toursStore.tours.map(t => t.id),
    ...toursStore.friendTours.filter(t => t.isPartner === true).map(t => t.id),
  ]))

  /** The tour an entry opens. A collision names the actor's tour; it opens the recipient's own. */
  function targetTourId(e: InboxNotification): string | null {
    const own = e.ref.other_tour_id
    return e.action === 'collision' && typeof own === 'string' ? own : e.tourId
  }

  function canOpenTour(tourId: string): boolean {
    return openableTourIds.value.has(tourId)
  }

  function staleReason(e: InboxNotification): InboxStaleReason | null {
    const subject = PENDING_SUBJECT[e.action]
    const refId = (key: string) => (typeof e.ref[key] === 'string' ? e.ref[key] as string : null)
    if (subject === 'friend' && friendsReady.value && !pendingFriendRequestIds.value.has(refId('request_id') ?? ''))
      return 'answered'
    if (subject === 'batch' && batchesReady.value && !pendingBatchIds.value.has(refId('batch_id') ?? ''))
      return 'resolved'
    if (subject === 'link' && linksReady.value && !pendingLinkIds.value.has(refId('request_id') ?? ''))
      return 'resolved'
    // A `deleted` entry is ABOUT a gone tour — that is its message, not staleness.
    const tourId = targetTourId(e)
    if (tourId && e.action !== 'deleted' && toursReady.value && !canOpenTour(tourId))
      return 'tourGone'
    return null
  }

  /** Unread AND still actionable — what the badges count (D7). */
  const attentionCount = computed(
    () => entries.value.filter(e => e.readAt === null && staleReason(e) === null).length,
  )

  // ── loading ────────────────────────────────────────────────────────────────
  function mergeById(...lists: InboxNotification[][]): InboxNotification[] {
    const byId = new Map<string, InboxNotification>()
    for (const list of lists) {
      for (const e of list)
        byId.set(e.id, e)
    }
    return [...byId.values()]
  }

  async function load() {
    if (!uid.value)
      return
    isLoading.value = true
    error.value = null
    try {
      await cachedLoad<InboxNotification[]>(
        cacheKey(),
        async () => {
          const [page, unread] = await Promise.all([
            repository.listPage(null, INBOX_PAGE_SIZE),
            repository.listUnread(UNREAD_CAP),
          ])
          hasMore.value = page.length === INBOX_PAGE_SIZE
          cursor = page.at(-1)?.createdAt ?? null
          return mergeById(page, unread)
        },
        (rows) => { entries.value = rows },
      )
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load inbox'
      logger.error('Failed to load inbox', err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || isLoading.value)
      return
    isLoading.value = true
    try {
      const page = await repository.listPage(cursor, INBOX_PAGE_SIZE)
      hasMore.value = page.length === INBOX_PAGE_SIZE
      cursor = page.at(-1)?.createdAt ?? cursor
      entries.value = mergeById(entries.value, page)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load inbox'
      logger.error('Failed to load more inbox entries', err)
    }
    finally {
      isLoading.value = false
    }
  }

  /** An entry by id — from memory, else fetched (a push can open an entry older than the pages). */
  async function find(id: string): Promise<InboxNotification | null> {
    const local = entries.value.find(e => e.id === id)
    if (local)
      return local
    try {
      const fetched = await repository.getById(id)
      if (fetched)
        entries.value = mergeById(entries.value, [fetched])
      return fetched
    }
    catch (err) {
      logger.warn('Failed to fetch inbox entry', err)
      return null
    }
  }

  // ── writes (offline-capable through the mutate seam) ───────────────────────
  // One `kind` for read + delete on purpose: `coalesce` keeps the existing entry's kind,
  // so a delete queued after a read of the same entry must replay through this handler.
  function write(
    entityId: string,
    op: 'update' | 'delete',
    payload: Record<string, unknown>,
    apply: (rows: InboxNotification[]) => InboxNotification[],
    online: () => Promise<void>,
  ) {
    return mutate<InboxNotification>({
      run: async () => {
        entries.value = apply(entries.value)
        try {
          await online()
        }
        catch (err) {
          logger.error('Inbox write failed', err)
          await load()
        }
      },
      intent: { entityId, kind: 'inbox', op, payload },
      cacheKey: cacheKey(),
      current: entries.value,
      apply,
      assign: (rows) => { entries.value = rows },
    })
  }

  function markRead(id: string) {
    const target = entries.value.find(e => e.id === id)
    if (!target || target.readAt)
      return
    const now = new Date().toISOString()
    return write(
      id,
      'update',
      {},
      rows => rows.map(e => (e.id === id && !e.readAt ? { ...e, readAt: now } : e)),
      () => repository.markRead(id),
    )
  }

  function markAllRead() {
    if (!uid.value || !entries.value.some(e => !e.readAt))
      return
    // Cutoff = newest entry the user has SEEN, not the clock: anything arriving later
    // (realtime or after reconnect) stays unread, and client clock skew can't matter.
    const cutoff = sorted.value[0]!.createdAt
    const now = new Date().toISOString()
    return write(
      `${ALL_KEY_PREFIX}${uid.value}`,
      'update',
      { cutoff },
      rows => rows.map(e => (!e.readAt && e.createdAt <= cutoff ? { ...e, readAt: now } : e)),
      () => repository.markAllRead(cutoff),
    )
  }

  function remove(id: string) {
    return write(id, 'delete', {}, rows => rows.filter(e => e.id !== id), () => repository.remove(id))
  }

  function clearAll() {
    if (!uid.value || entries.value.length === 0)
      return
    // Same cutoff rule as markAllRead: only what the user has seen goes. The server delete
    // also takes older pages never loaded, so there is nothing left to page through.
    const cutoff = sorted.value[0]!.createdAt
    hasMore.value = false
    cursor = null
    return write(
      `${CLEAR_KEY_PREFIX}${uid.value}`,
      'delete',
      { cutoff },
      rows => rows.filter(e => e.createdAt > cutoff),
      () => repository.removeAll(cutoff),
    )
  }

  // Idempotent by construction: read_at is monotonic and a delete of a gone row is a
  // no-op, so there is no LWW gate (D7).
  async function replayInbox(entry: WriteQueueEntry): Promise<void> {
    if (entry.entityId.startsWith(CLEAR_KEY_PREFIX))
      await repository.removeAll((entry.payload as { cutoff: string }).cutoff)
    else if (entry.entityId.startsWith(ALL_KEY_PREFIX))
      await repository.markAllRead((entry.payload as { cutoff: string }).cutoff)
    else if (entry.op === 'delete')
      await repository.remove(entry.entityId)
    else
      await repository.markRead(entry.entityId)
  }
  registerReplay('inbox', replayInbox)

  function clear() {
    entries.value = []
    hasMore.value = false
    cursor = null
    error.value = null
  }

  // Realtime: inserts + read updates are live; a DELETE from another device can't be
  // filtered by recipient and shows up on the next refetch (design: Risks).
  useRealtimeSubscription({
    key: () => (uid.value ? `inbox-${uid.value}` : null),
    enabled: () => authStore.isAuthenticated,
    bindings: () => (uid.value
      ? [{ event: '*', table: 'notifications', filter: `recipient_id=eq.${uid.value}` }]
      : []),
    onChange: load,
    onSubscribed: () => flushThenRefetch(load),
  })

  watch(() => authStore.isAuthenticated, (v) => {
    if (!v)
      clear()
  })

  return {
    entries: sorted,
    hasMore,
    isLoading,
    error,
    attentionCount,
    staleReason,
    targetTourId,
    canOpenTour,
    load,
    loadMore,
    find,
    markRead,
    markAllRead,
    clearAll,
    remove,
    clear,
  }
})
