import type { StagedBucket } from '@/features/tours/data/repositories/tour-suggestions-repository-impl'
import type {
  SuggestionItem,
  TourSuggestion,
} from '@/features/tours/domain/entities/tour-suggestion'
import type { ResolveResult } from '@/features/tours/domain/repositories/tour-suggestions-repository'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { notifyTourChanged, notifyTourSuggestion } from '@/features/notifications/data/notify-dispatch'
import {
  bucketForField,
  SupabaseTourSuggestionsRepository,
} from '@/features/tours/data/repositories/tour-suggestions-repository-impl'
import { groupIntoBatches } from '@/features/tours/domain/entities/tour-suggestion'
import { isMeaningfulSuggestionField } from '@/features/tours/domain/tour-notifications'

const repository = new SupabaseTourSuggestionsRepository()

export const useTourSuggestionsStore = defineStore('tourSuggestions', () => {
  const logger = useLogger('TourSuggestionsStore')
  const authStore = useAuthStore()

  const suggestions = ref<TourSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Staged paths already handed to the sweeper this session — don't re-delete every load. */
  const swept = new Set<string>()

  const currentUserId = computed(() => authStore.currentUser?.id ?? null)

  /**
   * Pending suggestions on the viewer's OWN tours, by tour (design D15). Feeds the tour
   * list indicator, the info-sheet badge and the review sheet alike — there is no per-tour
   * fetch, because one query already loaded every row the viewer may see.
   */
  const pendingCountByTour = computed<Record<string, number>>(() => {
    const uid = currentUserId.value
    const counts: Record<string, number> = {}
    if (!uid)
      return counts
    for (const s of suggestions.value) {
      if (s.ownerId === uid && s.status === 'pending')
        counts[s.tourId] = (counts[s.tourId] ?? 0) + 1
    }
    return counts
  })

  /** The viewer's own pending suggestions on a friend's tour — the seed for a revise (D12). */
  function myPendingFor(tourId: string): TourSuggestion[] {
    const uid = currentUserId.value
    return suggestions.value.filter(
      s => s.tourId === tourId && s.suggesterId === uid && s.status === 'pending',
    )
  }

  function pendingBatchesFor(tourId: string) {
    return groupIntoBatches(
      suggestions.value.filter(s => s.tourId === tourId && s.status === 'pending'),
    )
  }

  function resolvedBatchesFor(tourId: string) {
    return groupIntoBatches(
      suggestions.value.filter(s => s.tourId === tourId && s.status !== 'pending'),
    )
  }

  const channelKey = computed(() => {
    const uid = currentUserId.value
    return authStore.isAuthenticated && uid ? `tour-suggestions-${uid}` : null
  })

  // Realtime filters cannot join (design D8), which is why `owner_id` is denormalized onto
  // the row: the owner could not otherwise subscribe to "suggestions on my tours". Both
  // bindings share one channel key.
  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => authStore.isAuthenticated,
    bindings: () => {
      const uid = currentUserId.value
      if (!uid)
        return []
      return [
        { event: '*', table: 'tour_suggestion', filter: `owner_id=eq.${uid}` },
        { event: '*', table: 'tour_suggestion', filter: `suggester_id=eq.${uid}` },
      ]
    },
    onChange: () => { void load() },
    // MANDATORY (architecture rule): a hidden tab tears the channel down, so events in
    // that window are lost. Every (re-)subscribe does a FULL refetch to close the gap.
    onSubscribed: () => { void load() },
  })

  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed)
        clear()
    },
  )

  async function load() {
    const uid = currentUserId.value
    if (!uid)
      return

    loading.value = true
    error.value = null
    try {
      // Reads are cached (D14): an owner opening a tour offline sees a stale-but-truthful
      // pending count rather than a silent zero, which would read as "nobody suggested
      // anything" — the exact false negative the offline data cache exists to prevent.
      await cachedLoad(
        `suggestions:${uid}`,
        () => repository.listForUser(),
        (rows) => { suggestions.value = rows },
      )
      void sweepOwnStaged()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load suggestions'
      logger.error('load suggestions failed', err)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Delete the staged blobs of the caller's OWN resolved suggestions (design D9). The
   * split is forced by Storage's prefix model: only the author holds delete rights on
   * their own prefix, so nobody else can clean these up. Best-effort and non-blocking.
   */
  async function sweepOwnStaged() {
    const uid = currentUserId.value
    if (!uid)
      return

    const targets: { bucket: StagedBucket, path: string }[] = []
    for (const s of suggestions.value) {
      if (s.suggesterId !== uid || s.status === 'pending')
        continue
      const bucket = bucketForField(s.field)
      const path = (s.value as { storagePath?: string } | null)?.storagePath
      if (!bucket || !path || !path.startsWith(`${uid}/suggestions/`) || swept.has(path))
        continue
      swept.add(path)
      targets.push({ bucket, path })
    }

    if (targets.length === 0)
      return

    try {
      await repository.sweepStaged(targets)
    }
    catch (err) {
      logger.warn('staged sweep failed (non-critical)', err)
    }
  }

  /**
   * Submit or revise a batch (design D12) — ONE idempotent reconciling call, never a
   * multi-write sequence. `isRevision` decides only the notification: the owner already
   * knows an unresolved batch exists and their review sheet updates live (D16).
   */
  async function submitBatch(
    tourId: string,
    batchId: string,
    items: SuggestionItem[],
    isRevision = false,
  ) {
    error.value = null
    // Writes are online-only (D6). Offline suggest/accept would need a replay handler per
    // action plus a conflict rule composing offline LWW with suggestion staleness — two
    // independent notions of "the base moved". The block form drops the write and raises
    // the global offline notice; nothing is queued.
    return mutate(async () => {
      try {
        await repository.upsertBatch(tourId, batchId, items)
        if (!isRevision && items.length > 0)
          notifyTourSuggestion(batchId, 'submitted')
        await load()
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to submit suggestions'
        logger.error('submit suggestions failed', err)
        throw err
      }
    })
  }

  async function accept(suggestion: TourSuggestion) {
    return resolve(
      () => repository.accept(suggestion),
      'Failed to accept suggestion',
    )
  }

  async function acceptBatch(batchId: string) {
    const rows = suggestions.value.filter(s => s.batchId === batchId && s.status === 'pending')
    return resolve(
      () => repository.acceptBatch(batchId, rows),
      'Failed to accept suggestions',
    )
  }

  async function decline(id: string) {
    return resolve(() => repository.decline(id), 'Failed to decline suggestion')
  }

  async function withdraw(id: string) {
    error.value = null
    return mutate(async () => {
      try {
        await repository.withdraw(id)
        await load()
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to withdraw suggestion'
        logger.error('withdraw suggestion failed', err)
        throw err
      }
    })
  }

  /**
   * The shared tail of every owner-side resolution. Dispatch happens HERE, on success —
   * never from the realtime `onChange` (architecture rule: realtime is UI-sync only).
   */
  async function resolve(run: () => Promise<ResolveResult>, fallbackMessage: string) {
    error.value = null
    return mutate(async () => {
      try {
        const result = await run()

        // The author hears once, on the batch's transition to fully resolved (D16). D7's
        // auto-declines surface their batches through the same list.
        for (const batchId of result.resolvedBatches)
          notifyTourSuggestion(batchId, 'resolved')

        // An accepted partner-facing field is a tour change like any other: the OTHER
        // partners need it. The actor is dropped by the Worker's JWT match; the author is
        // excluded explicitly — they already have their own `tour_suggestions` notice.
        if (result.tourId && result.fields.some(isMeaningfulSuggestionField)) {
          const authorIds = [
            ...new Set(
              suggestions.value
                .filter(s => s.tourId === result.tourId)
                .map(s => s.suggesterId),
            ),
          ]
          notifyTourChanged(result.tourId, 'updated', undefined, authorIds)
        }

        await load()
        return result
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : fallbackMessage
        logger.error(fallbackMessage, err)
        throw err
      }
    })
  }

  async function uploadStaged(bucket: StagedBucket, tourId: string, file: File) {
    const uid = currentUserId.value
    if (!uid)
      throw new Error('Not authenticated')
    return repository.uploadStaged(bucket, tourId, uid, file)
  }

  function clear() {
    suggestions.value = []
    error.value = null
    swept.clear()
  }

  return {
    suggestions,
    loading,
    error,
    pendingCountByTour,
    myPendingFor,
    pendingBatchesFor,
    resolvedBatchesFor,
    load,
    submitBatch,
    accept,
    acceptBatch,
    decline,
    withdraw,
    uploadStaged,
    clear,
  }
})
