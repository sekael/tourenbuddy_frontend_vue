import type { Visibility } from '@/features/tours/data/models/visibility'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
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
    onSubscribed: () => loadTours(),
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

  async function createTourFromDraft(
    draft: TourDraft,
    goal: { lng: number, lat: number },
    preUploadedTourId: string | null = null,
  ): Promise<string | null> {
    // Blocked offline (design D5): the seam drops the write and notifies; offline →
    // undefined collapses to null, the same result as the no-user early return.
    return (await mutate(async () => {
      const userId = authStore.currentUser?.id
      if (!userId)
        return null

      const id = preUploadedTourId ?? uuidv4()
      // Single atomic write: tour + partners + visibility + gpx filepath in one RPC.
      // (GPX is uploaded at file-pick time in the form; its path rides in via draft.)
      await repository.createTourWithPartners(id, draft, goal)

      await loadTours()

      // Notify friend partners of the new shared tour (Worker filters to actual friends).
      if (isShareableTour(draft.visibility, draft.partnerIds))
        notifyTourChanged(id, 'created')

      return id
    })) ?? null
  }

  async function updateTour(
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
    gpxRemoved: boolean = false,
  ) {
    return mutate(async () => {
      const existing = tours.value.find(t => t.id === id)
      const previousFilepath = existing?.gpxFilepath ?? null

      // Snapshot link-group audience BEFORE mutating: DB trigger may evict this
      // tour (type / visibility / goal change) and the dissolution trigger may
      // wipe the group inside the same txn. fn_evict_member_on_tour_change.
      const tourLinksStore = useTourLinksStore()
      const linkSnapshot = tourLinksStore.snapshotTourGroupContext(id)

      let updated: boolean
      try {
        // Single atomic write: row + partners + visibility folded into one RPC.
        updated = await repository.updateTour(id, draft, goal)
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to update tour'
        logger.error('updateTour failed', err)
        throw err
      }

      // false ⇒ the tour is gone (concurrent delete). Abort BEFORE the eviction dispatch
      // and the optimistic tours.value rewrite, else we'd resurrect a phantom row locally.
      if (!updated) {
        error.value = 'Failed to update tour'
        throw new Error('Tour no longer exists')
      }

      // Mutation committed → if it tripped an eviction trigger, fire the
      // dissolution / evicted_external notification. Best-effort.
      tourLinksStore.dispatchEvictionIfHappened(linkSnapshot, id).catch((err) => {
        logger.warn('dispatchEvictionIfHappened (updateTour) failed', err)
      })

      const newFilepath = gpxRemoved ? null : draft.gpxFilepath

      if (previousFilepath && previousFilepath !== newFilepath) {
        try {
          await removeGpx(previousFilepath)
        }
        catch (err) {
          logger.warn('Tour updated but old GPX blob removal failed (orphan)', err)
        }
      }

      if (!existing)
        return

      tours.value = tours.value.map(t =>
        t.id === id
          ? {
              ...existing,
              name: draft.name,
              plannedDate: draft.plannedDate,
              partnerIds: draft.partnerIds,
              tourType: draft.tourType,
              elevation: draft.elevation,
              gpxFilepath: newFilepath ?? null,
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
              visibility: draft.visibility ?? existing.visibility,
              goal,
            }
          : t,
      )

      // Notify friend partners only on a partner-facing change to a shareable tour.
      const effectiveVisibility = draft.visibility ?? existing.visibility
      if (
        isShareableTour(effectiveVisibility, draft.partnerIds)
        && isMeaningfulTourChange(existing, draft, { goal, gpxFilepath: newFilepath ?? null })
      ) {
      // Partners added by this edit get the "shared with you" greeting; pre-existing
      // partners get the generic "updated" copy. Diff on contact ids (the id space the
      // Worker's users_by_contact_ids resolves).
        const prevPartners = new Set(existing.partnerIds)
        const addedPartnerIds = draft.partnerIds.filter(pid => !prevPartners.has(pid))
        notifyTourChanged(id, 'updated', addedPartnerIds)
      }

      // Independent of meaningful-edit filter: re-scan for friend collisions on every
      // update (goal / type / visibility may have changed). Worker no-ops for private tours.
      if (effectiveVisibility === 'friends')
        notifyTourInterest(id)
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
    return mutate(async () => {
      const tour = tours.value.find(t => t.id === id)
      // Cache what the notification needs BEFORE the row (and its tour_partners) are
      // gone; dispatch only AFTER a confirmed delete so a failed delete sends nothing.
      const shouldNotify = !!tour && isShareableTour(tour.visibility, tour.partnerIds)
      const partnerContactIds = tour?.partnerIds ?? []
      const tourName = tour?.name ?? ''
      // Tour delete cascades member row removal → group may dissolve. Snapshot
      // audience before the row is gone; eviction is unconditional so we fire
      // directly afterwards without a "did it happen?" check.
      const tourLinksStore = useTourLinksStore()
      const linkSnapshot = tourLinksStore.snapshotTourGroupContext(id)
      await repository.deleteTour(id)
      if (shouldNotify)
        notifyTourDeleted(partnerContactIds, tourName)
      if (linkSnapshot)
        tourLinksStore.dispatchEvictionNotification(linkSnapshot)
      if (tour?.gpxFilepath) {
        try {
          await removeGpx(tour.gpxFilepath)
        }
        catch (err) {
          logger.warn('Tour deleted but GPX blob removal failed (orphan)', err)
        }
      }
      tours.value = tours.value.filter(t => t.id !== id)
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
