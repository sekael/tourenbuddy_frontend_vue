import type { WriteQueueEntry } from '@/core/offline/write-queue'
import type { Visibility } from '@/features/tours/data/models/visibility'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { clearPendingUpload, isPendingUpload, peekCachedBlob } from '@/core/offline/blob-cache'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { isOnline } from '@/core/offline/use-online-status'
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
import { removeGpx, uploadGpxToKey } from '@/features/tours/data/services/gpx-storage-service'
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

  /** Snapshot a tour back into a full draft, so field-toggles (completed/visibility) reuse the update path. */
  function tourToDraft(tour: Tour): TourDraft {
    return {
      name: tour.name,
      plannedDate: tour.plannedDate,
      partnerIds: tour.partnerIds,
      tourType: tour.tourType,
      elevation: tour.elevation,
      gpxFilepath: tour.gpxFilepath,
      description: tour.description,
      seasons: tour.seasons,
      startPoint: tour.startPoint,
      endPoint: tour.endPoint,
      startPointName: tour.startPointName,
      startPointElevation: tour.startPointElevation,
      endPointName: tour.endPointName,
      endPointElevation: tour.endPointElevation,
      equipment: tour.equipment,
      notes: tour.notes,
      completed: tour.completed,
      visibility: tour.visibility,
    }
  }

  // DC6 deferred notification + eviction dispatch, keyed on ctx.op. Called by BOTH the
  // online action body and the replay handler (identical by construction) — fires exactly
  // one notification for the net op, best-effort, only after a successful write. Enqueue
  // fires nothing.
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
        if (draft && previous && goal && isShareableTour(effVis, draft.partnerIds)) {
          const meaningful = isMeaningfulTourChange(previous, draft, { goal, gpxFilepath })
          // Completion is deliberately NOT part of isMeaningfulTourChange (a form edit
          // never touches it), so a setCompleted-as-update flip needs its own trigger.
          // `!= null` skips form edits that leave `completed` undefined — only a
          // deliberate toggle sets it — so this can't spuriously fire on a plain edit.
          const completionFlipped = draft.completed != null && draft.completed !== previous.completed
          if (meaningful || completionFlipped) {
            const prevPartners = new Set(previous.partnerIds)
            const addedIds = draft.partnerIds.filter(cid => !prevPartners.has(cid))
            notifyTourChanged(ctx.id, 'updated', addedIds)
            // Interest scan stays gated on a meaningful edit — a completion/visibility
            // toggle alone shouldn't re-scan colliding friend tours (avoids notify spam).
            if (meaningful && effVis === 'friends')
              notifyTourInterest(ctx.id)
          }
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

  /**
   * The GPX blob to ride on a queue entry, iff it was staged offline and still needs
   * uploading (pending mark). Gating on the mark — not mere cache presence — keeps a blob
   * cached only for display (already in Storage) out of the queue, so an offline field
   * toggle doesn't re-queue a multi-MB track.
   */
  async function stagedGpxBlobs(gpxFilepath: string | null): Promise<Record<string, Blob> | undefined> {
    if (!gpxFilepath || !(await isPendingUpload(gpxFilepath)))
      return undefined
    const blob = await peekCachedBlob(gpxFilepath)
    return blob ? { [gpxFilepath]: blob } : undefined
  }

  /** Approx bytes a blob set adds to the queue, for the DC2 quota guard. */
  function blobBytes(blobs: Record<string, Blob> | undefined): number {
    return blobs ? Object.values(blobs).reduce((n, b) => n + b.size, 0) : 0
  }

  /** Upload any GPX blob(s) staged offline to Storage before the row write (idempotent, upsert). */
  async function uploadEntryBlobs(entry: WriteQueueEntry): Promise<void> {
    if (!entry.blobs)
      return
    for (const [key, blob] of Object.entries(entry.blobs)) {
      await uploadGpxToKey(key, blob)
      await clearPendingUpload(key)
    }
  }

  /** Replay a queued tour write on reconnect (DC3): one idempotent call by op + deferred notify (DC6). */
  async function replayTourWrite(entry: WriteQueueEntry): Promise<void> {
    const payload = entry.payload as TourWritePayload
    if (entry.op === 'delete') {
      await repository.deleteTour(entry.entityId)
    }
    else if (entry.op === 'create') {
      // Blob first: a create referencing a never-uploaded GPX would leave a dangling path.
      await uploadEntryBlobs(entry)
      await repository.createTourWithPartners(entry.entityId, payload.draft, payload.goal)
    }
    else {
      // LWW (DC5): a server row newer than our baseline won — don't clobber it.
      const serverTs = await repository.getUpdatedAt(entry.entityId)
      if (serverTs === null)
        throw new PermanentReplayError('tour was deleted on the server')
      if (entry.baseUpdatedAt && new Date(serverTs) > new Date(entry.baseUpdatedAt))
        throw new PermanentReplayError('tour changed on the server since this edit (LWW loser)')
      // Upload after the LWW gate so a losing update doesn't orphan a blob in Storage.
      await uploadEntryBlobs(entry)
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
    // A GPX picked offline is staged in the blob cache (not yet in Storage); ride it on the
    // queue entry so replay uploads it. Online the form already uploaded → skip the lookup.
    const blobs = isOnline.value ? undefined : await stagedGpxBlobs(draft.gpxFilepath ?? null)
    const result = await mutate<Tour>({
      run: async () => {
        // Single atomic write: tour + partners + visibility + gpx filepath in one RPC.
        // (Online, GPX is uploaded at file-pick time in the form; its path rides in via draft.)
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
      intent: { entityId: id, kind: 'tour', op: 'create', payload: { draft, goal }, blobs, linkSnapshot: null },
      projectedBytes: blobBytes(blobs),
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

    // A GPX replaced offline is staged in the blob cache — ride it on the queue entry.
    const blobs = isOnline.value ? undefined : await stagedGpxBlobs(newFilepath)
    return mutate<Tour>({
      run: async () => {
        // Apply optimistically BEFORE the write so the edit (esp. a completed/visibility
        // toggle) feels instant online; roll back to this snapshot on any failure.
        const rollback = tours.value
        tours.value = applyEdit(tours.value)

        let updated: boolean
        try {
          // Single atomic write: row + partners + visibility folded into one RPC.
          updated = await repository.updateTour(id, draftWithFilepath, goal)
        }
        catch (err) {
          tours.value = rollback
          error.value = err instanceof Error ? err.message : 'Failed to update tour'
          logger.error('updateTour failed', err)
          throw err
        }
        // false ⇒ the tour is gone (concurrent delete). Roll back the optimistic rewrite
        // (and skip notify), else we'd resurrect a phantom row locally.
        if (!updated) {
          tours.value = rollback
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
        blobs,
        baseSnapshot: existing,
        baseUpdatedAt: existing?.updatedAt ?? undefined,
        linkSnapshot,
      },
      projectedBytes: blobBytes(blobs),
      cacheKey: cacheKey(),
      current: tours.value,
      apply: applyEdit,
      assign: (rows) => { tours.value = rows },
    })
  }

  // setCompleted / setVisibility are field-toggles modelled as a full tour update
  // (Path Y unification): they build a draft from the current tour with the one field
  // changed and reuse updateTour — so they queue, replay, coalesce, notify (deferred
  // seam) and evict through the exact same path as a form edit, online or offline.
  async function setCompleted(tourId: string, completed: boolean) {
    const tour = tours.value.find(t => t.id === tourId)
    if (!tour)
      return
    logger.debug('setCompleted', { tourId, completed })
    return updateTour(tourId, { ...tourToDraft(tour), completed }, tour.goal)
  }

  async function setVisibility(tourId: string, visibility: Visibility) {
    const tour = tours.value.find(t => t.id === tourId)
    if (!tour)
      return
    return updateTour(tourId, { ...tourToDraft(tour), visibility }, tour.goal)
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
