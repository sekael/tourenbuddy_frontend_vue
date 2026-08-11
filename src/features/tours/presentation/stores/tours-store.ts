import type { WriteQueueEntry } from '@/core/offline/write-queue'
import type { Visibility } from '@/features/tours/data/models/visibility'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { flushThenRefetch } from '@/core/offline/reconnect'
import { PermanentReplayError, registerReplay } from '@/core/offline/replay'
import { useRealtimeBroadcast } from '@/core/realtime/use-realtime-broadcast'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import {
  notifyTourChanged,
  notifyTourDeleted,
  notifyTourInterest,
} from '@/features/notifications/data/notify-dispatch'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import { ToursRepositoryImpl } from '@/features/tours/data/repositories/tours-repository-impl'
import { removeGpx } from '@/features/tours/data/services/gpx-storage-service'
import { isMeaningfulTourChange, isShareableTour } from '@/features/tours/domain/tour-notifications'

const repository = new ToursRepositoryImpl()

/** Link-group audience snapshot for deferred eviction dispatch (DC6). */
type LinkSnapshot = ReturnType<ReturnType<typeof useTourLinksStore>['snapshotTourGroupContext']>

/** Serializable replay payload for a tour create/update — the write to re-run (DC3). */
interface TourWritePayload {
  draft: TourDraft
  goal: { lng: number, lat: number }
}

/**
 * Context for the shared deferred-notify seam (DC6). Populated identically by the
 * online action body and the reconnect replay handler, so a notification fires once,
 * on successful write, keyed on `op` — never at enqueue time, never twice.
 */
interface TourNotifyContext {
  op: WriteQueueEntry['op']
  id: string
  /** New desired state (create/update); null for delete. */
  draft: TourDraft | null
  goal: { lng: number, lat: number } | null
  /** Resolved new gpx filepath after the edit (update). */
  gpxFilepath: string | null
  /** Server baseline: null for create; the pre-write tour for update/delete. */
  previous: Tour | null
  linkSnapshot: LinkSnapshot
}

export const useToursStore = defineStore('tours', () => {
  const logger = useLogger('ToursStore')
  const authStore = useAuthStore()
  const contactsStore = useContactsStore()
  const friendshipsStore = useFriendshipsStore()

  const tours = ref<Tour[]>([])
  const friendTours = ref<Tour[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  // Monotonic token so only the latest-initiated loadFriendTours assigns (see below).
  let friendToursSeq = 0

  watch(
    () => authStore.isAuthenticated,
    (authed, wasAuthed) => {
      if (authed && !wasAuthed) {
        loadTours()
        loadFriendTours()
      }
      else if (!authed && wasAuthed) {
        clear()
      }
    },
  )

  // The store is created lazily (first view that uses it), often after auth has
  // already been restored at bootstrap — so the watcher above never sees the
  // false→true transition. Owned tours still arrive via the realtime channel's
  // onSubscribed reload; friend tours have no such trigger, so kick their initial
  // load here when the session is already live.
  if (authStore.isAuthenticated)
    void loadFriendTours()

  contactsStore.$onAction(({ name, args, after }) => {
    if (name !== 'deleteContact')
      return
    after(() => {
      const deletedId = args[0] as string
      if (!tours.value.some(t => t.partnerIds.includes(deletedId)))
        return
      tours.value = tours.value.map(t =>
        t.partnerIds.includes(deletedId)
          ? { ...t, partnerIds: t.partnerIds.filter(id => id !== deletedId) }
          : t,
      )
    })
  })

  // Friend-set mutations the local user performs (accept / removeFriendship) update
  // friendUserIds optimistically BEFORE the DB commits, so the friendUserIds watch
  // fires a premature loadFriendTours that reads the view before the row exists.
  // Refetch in `after` (post-commit) so the accepter sees the new friend's tours.
  friendshipsStore.$onAction(({ name, after }) => {
    if (name !== 'accept' && name !== 'removeFriendship')
      return
    after(() => loadFriendTours())
  })

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && uid ? `tours-${uid}` : null
  })
  const realtimeEnabled = computed(() => authStore.isAuthenticated)

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => realtimeEnabled.value,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      return [
        { event: '*', table: 'tours', filter: `user_id=eq.${uid}` },
        { event: '*', table: 'tour_partners', filter: `user_id=eq.${uid}` },
      ]
    },
    onChange: loadTours,
    // DC4: flush the write queue BEFORE the reconnect refetch, so a replayed offline
    // write lands server-side before the fresh snapshot overwrites the store.
    onSubscribed: () => flushThenRefetch(loadTours),
  })

  useRealtimeBroadcast({
    topic: () => {
      const uid = authStore.currentUser?.id
      return uid ? `friend-tours:${uid}` : null
    },
    enabled: () => realtimeEnabled.value,
    event: 'refetch',
    onMessage: loadFriendTours,
    onSubscribed: loadFriendTours,
  })

  watch(
    () => [...friendshipsStore.friendUserIds].sort().join(','),
    (n, o) => {
      if (n !== o)
        loadFriendTours()
    },
  )

  async function loadTours() {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    isLoading.value = true
    error.value = null

    try {
      // Hydrate from cache, then (online) refetch + overwrite the cache (design D3).
      await cachedLoad(
        `tours:${userId}`,
        () => repository.listToursForUser(userId),
        (result) => { tours.value = result },
      )
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tours'
      error.value = message
      logger.error('Failed to load tours', err)
    }
    finally {
      isLoading.value = false
    }
  }

  // Friend tours are a separate collection synced via realtime broadcast (#198) and
  // refetched on friend-set change. Concurrent refetches can race (e.g. a premature
  // optimistic-triggered fetch vs. a post-commit one); a monotonic token ensures only
  // the latest-initiated call assigns, so a slow stale fetch can't blank the list.
  async function loadFriendTours() {
    const uid = authStore.currentUser?.id
    if (!uid)
      return

    // Race guard preserved inside assign: it runs for both the cache-hydrate and the
    // fresh refetch, so a slow stale result (cache or network) can't blank a newer one.
    const req = ++friendToursSeq
    try {
      await cachedLoad(
        `friend-tours:${uid}`,
        () => repository.listFriendTours(),
        (result) => {
          if (req === friendToursSeq)
            friendTours.value = result
        },
      )
    }
    catch (err) {
      logger.error('Failed to load friend tours', err)
    }
  }

  const cacheKey = () => `tours:${authStore.currentUser?.id}`

  /** Build a full Tour for optimistic apply from a create/update draft (base = existing for update). */
  function tourFromDraft(
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
    base: Tour | null,
  ): Tour {
    return {
      id,
      userId: base?.userId ?? authStore.currentUser?.id ?? '',
      plannedDate: draft.plannedDate ?? null,
      goal,
      name: draft.name,
      partnerIds: draft.partnerIds,
      tourType: draft.tourType,
      elevation: draft.elevation,
      gpxFilepath: draft.gpxFilepath ?? null,
      description: draft.description,
      seasons: draft.seasons,
      startPoint: draft.startPoint,
      endPoint: draft.endPoint,
      startPointName: draft.startPointName ?? null,
      startPointElevation: draft.startPointElevation ?? null,
      endPointName: draft.endPointName ?? null,
      endPointElevation: draft.endPointElevation ?? null,
      equipment: draft.equipment,
      notes: draft.notes,
      completed: draft.completed ?? base?.completed ?? false,
      visibility: draft.visibility ?? base?.visibility ?? 'friends',
      updatedAt: base?.updatedAt ?? null,
      isFriendTour: false,
    }
  }

  // TODO(me): DC6 deferred notification + eviction dispatch, keyed on ctx.op.
  //   See task list at the end of this response.
  //
  // Called by BOTH the online action body and the replay handler (identical by
  // construction — the DC6 guarantee). Fire exactly one notification for the net op,
  // best-effort, using the already-imported helpers (isShareableTour,
  // isMeaningfulTourChange, notifyTourChanged, notifyTourInterest, notifyTourDeleted)
  // + the tour-links store (useTourLinksStore(): dispatchEvictionIfHappened /
  // dispatchEvictionNotification):
  //   - create → notifyTourChanged(id, 'created') when isShareableTour
  //   - update → dispatchEvictionIfHappened(linkSnapshot, id); then when shareable AND
  //              isMeaningfulTourChange(previous, draft, { goal, gpxFilepath }):
  //              notifyTourChanged(id, 'updated', <ONLY newly-added partner ids>);
  //              plus notifyTourInterest(id) when effective visibility === 'friends'
  //   - delete → notifyTourDeleted(previous.partnerIds, previous.name) when shareable;
  //              plus dispatchEvictionNotification(linkSnapshot) when snapshot present
  // Enqueue fires NOTHING — this runs only after a successful write.
  function dispatchTourWriteNotifications(ctx: TourNotifyContext): void {
    switch (ctx.op) {
      case 'create': {
        const draft = ctx.draft
        if (draft && isShareableTour(draft.visibility, draft.partnerIds)) {
          notifyTourChanged(ctx.id, 'created')
        }
        break
      }
      case 'update': {
        const { draft, previous, goal, gpxFilepath } = ctx
        // Eviction fires regardless of shareable/meaningful (a friends → private flip
        // on a linked tour trips it precisely when the notify below is suppressed).
        useTourLinksStore().dispatchEvictionIfHappened(ctx.linkSnapshot, ctx.id).catch((err) => {
          logger.warn('dispatchEvictionIfHappened (tour update notify) failed', err)
        })
        const effVis = draft?.visibility ?? previous?.visibility
        if (
          draft && previous && goal
          && isShareableTour(effVis, draft.partnerIds)
          && isMeaningfulTourChange(previous, draft, { goal, gpxFilepath })
        ) {
          const prevPartners = new Set(previous.partnerIds)
          const addedIds = draft.partnerIds.filter(cid => !prevPartners.has(cid))
          notifyTourChanged(ctx.id, 'updated', addedIds)
          if (effVis === 'friends')
            notifyTourInterest(ctx.id)
        }
        break
      }
      case 'delete': {
        const previous = ctx.previous
        if (previous && isShareableTour(previous.visibility, previous.partnerIds)) {
          notifyTourDeleted(previous.partnerIds, previous.name ?? '')
        }

        if (ctx.linkSnapshot)
          useTourLinksStore().dispatchEvictionNotification(ctx.linkSnapshot)
        break
      }
      default:
    }
  }

  /** Replay a queued tour write on reconnect (DC3): one idempotent call by op + deferred notify (DC6). */
  async function replayTourWrite(entry: WriteQueueEntry): Promise<void> {
    const payload = entry.payload as TourWritePayload
    if (entry.op === 'delete') {
      await repository.deleteTour(entry.entityId)
    }
    else if (entry.op === 'create') {
      await repository.createTourWithPartners(entry.entityId, payload.draft, payload.goal)
    }
    else {
      // LWW (DC5): a server row newer than our baseline won — don't clobber it.
      const serverTs = await repository.getUpdatedAt(entry.entityId)
      if (serverTs === null)
        throw new PermanentReplayError('tour was deleted on the server')
      if (entry.baseUpdatedAt && new Date(serverTs) > new Date(entry.baseUpdatedAt))
        throw new PermanentReplayError('tour changed on the server since this edit (LWW loser)')
      const updated = await repository.updateTour(entry.entityId, payload.draft, payload.goal)
      if (!updated)
        throw new PermanentReplayError('tour was deleted on the server')
    }

    const isWrite = entry.op !== 'delete'
    dispatchTourWriteNotifications({
      op: entry.op,
      id: entry.entityId,
      draft: isWrite ? payload.draft : null,
      goal: isWrite ? payload.goal : null,
      gpxFilepath: isWrite ? (payload.draft.gpxFilepath ?? null) : null,
      previous: (entry.baseSnapshot as Tour | undefined) ?? null,
      linkSnapshot: (entry.linkSnapshot as LinkSnapshot) ?? null,
    })
  }
  registerReplay('tour', replayTourWrite)

  async function createTourFromDraft(
    draft: TourDraft,
    goal: { lng: number, lat: number },
    preUploadedTourId: string | null = null,
  ): Promise<string | null> {
    const userId = authStore.currentUser?.id
    if (!userId)
      return null

    const id = preUploadedTourId ?? uuidv4()
    const result = await mutate<Tour>({
      run: async () => {
        // Single atomic write: tour + partners + visibility + gpx filepath in one RPC.
        // (GPX is uploaded at file-pick time in the form; its path rides in via draft.)
        await repository.createTourWithPartners(id, draft, goal)
        await loadTours()
        dispatchTourWriteNotifications({
          op: 'create',
          id,
          draft,
          goal,
          gpxFilepath: draft.gpxFilepath ?? null,
          previous: null,
          linkSnapshot: null,
        })
      },
      intent: { entityId: id, kind: 'tour', op: 'create', payload: { draft, goal }, linkSnapshot: null },
      cacheKey: cacheKey(),
      current: tours.value,
      apply: rows => [...rows, tourFromDraft(id, draft, goal, null)],
      assign: (rows) => { tours.value = rows },
    })

    // Offline: the row is saved to the queue and applied optimistically — the minted id
    // is already final (client-side UUID, DC0), so return it either way.
    return result.queued ? id : id
  }

  async function updateTour(
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
    gpxRemoved: boolean = false,
  ) {
    const existing = tours.value.find(t => t.id === id) ?? null
    const previousFilepath = existing?.gpxFilepath ?? null
    const newFilepath = gpxRemoved ? null : (draft.gpxFilepath ?? null)
    const draftWithFilepath: TourDraft = { ...draft, gpxFilepath: newFilepath }

    // Snapshot link-group audience BEFORE the write: an eviction trigger may fire and
    // the dissolution trigger may wipe the group. Carried on the queue entry so a
    // replayed write can still run the deferred eviction dispatch (DC6).
    const linkSnapshot = useTourLinksStore().snapshotTourGroupContext(id)

    const applyEdit = (rows: Tour[]): Tour[] =>
      existing
        ? rows.map(t => (t.id === id ? tourFromDraft(id, draftWithFilepath, goal, existing) : t))
        : rows

    return mutate<Tour>({
      run: async () => {
        let updated: boolean
        try {
          // Single atomic write: row + partners + visibility folded into one RPC.
          updated = await repository.updateTour(id, draftWithFilepath, goal)
        }
        catch (err) {
          error.value = err instanceof Error ? err.message : 'Failed to update tour'
          logger.error('updateTour failed', err)
          throw err
        }
        // false ⇒ the tour is gone (concurrent delete). Abort BEFORE the optimistic
        // rewrite + notify, else we'd resurrect a phantom row locally.
        if (!updated) {
          error.value = 'Failed to update tour'
          throw new Error('Tour no longer exists')
        }
        if (previousFilepath && previousFilepath !== newFilepath) {
          try {
            await removeGpx(previousFilepath)
          }
          catch (err) {
            logger.warn('Tour updated but old GPX blob removal failed (orphan)', err)
          }
        }
        tours.value = applyEdit(tours.value)
        dispatchTourWriteNotifications({
          op: 'update',
          id,
          draft: draftWithFilepath,
          goal,
          gpxFilepath: newFilepath,
          previous: existing,
          linkSnapshot,
        })
      },
      intent: {
        entityId: id,
        kind: 'tour',
        op: 'update',
        payload: { draft: draftWithFilepath, goal },
        baseSnapshot: existing,
        baseUpdatedAt: existing?.updatedAt ?? undefined,
        linkSnapshot,
      },
      cacheKey: cacheKey(),
      current: tours.value,
      apply: applyEdit,
      assign: (rows) => { tours.value = rows },
    })
  }

  async function setCompleted(tourId: string, completed: boolean) {
    return mutate(async () => {
      const tour = tours.value.find(t => t.id === tourId)
      if (!tour)
        return

      tours.value = tours.value.map(t => (t.id === tourId ? { ...t, completed } : t))
      logger.debug('setCompleted', { tourId, completed })

      try {
        await repository.patchCompleted(tourId, completed)
        // Completion flip is a partner-facing change.
        if (isShareableTour(tour.visibility, tour.partnerIds))
          notifyTourChanged(tourId, 'updated')
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to update tour'
        logger.error('setCompleted failed, resyncing from server', err)
        await loadTours()
      }
    })
  }

  async function setVisibility(tourId: string, visibility: Visibility) {
    return mutate(async () => {
      const tour = tours.value.find(t => t.id === tourId)
      if (!tour)
        return

      const previous = tour.visibility
      tours.value = tours.value.map(t => (t.id === tourId ? { ...t, visibility } : t))

      // Same eviction snapshot pattern as updateTour: a friends → non-friends
      // flip on a linked tour trips the eviction trigger.
      const tourLinksStore = useTourLinksStore()
      const linkSnapshot = tourLinksStore.snapshotTourGroupContext(tourId)

      try {
        await repository.patchVisibility(tourId, visibility)
      }
      catch (err) {
        tours.value = tours.value.map(t => (t.id === tourId ? { ...t, visibility: previous } : t))
        error.value = err instanceof Error ? err.message : 'Failed to update visibility'
        logger.error('setVisibility failed', err)
        return
      }

      tourLinksStore.dispatchEvictionIfHappened(linkSnapshot, tourId).catch((err) => {
        logger.warn('dispatchEvictionIfHappened (setVisibility) failed', err)
      })
    })
  }

  async function deleteTour(id: string) {
    // Capture what notify + eviction need BEFORE the row (and its tour_partners) are
    // gone; both are dispatched only AFTER a confirmed delete (in the shared seam).
    const tour = tours.value.find(t => t.id === id) ?? null
    const linkSnapshot = useTourLinksStore().snapshotTourGroupContext(id)

    return mutate<Tour>({
      run: async () => {
        await repository.deleteTour(id)
        if (tour?.gpxFilepath) {
          try {
            await removeGpx(tour.gpxFilepath)
          }
          catch (err) {
            logger.warn('Tour deleted but GPX blob removal failed (orphan)', err)
          }
        }
        tours.value = tours.value.filter(t => t.id !== id)
        dispatchTourWriteNotifications({
          op: 'delete',
          id,
          draft: null,
          goal: null,
          gpxFilepath: null,
          previous: tour,
          linkSnapshot,
        })
      },
      intent: { entityId: id, kind: 'tour', op: 'delete', payload: {}, baseSnapshot: tour, linkSnapshot },
      cacheKey: cacheKey(),
      current: tours.value,
      apply: rows => rows.filter(t => t.id !== id),
      assign: (rows) => { tours.value = rows },
    })
  }

  function clear() {
    tours.value = []
    friendTours.value = []
    error.value = null
  }

  return {
    tours,
    friendTours,
    isLoading,
    error,
    loadTours,
    loadFriendTours,
    createTourFromDraft,
    updateTour,
    setCompleted,
    setVisibility,
    deleteTour,
    clear,
  }
})
