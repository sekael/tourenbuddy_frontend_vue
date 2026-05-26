import type { Visibility } from '@/features/tours/data/models/visibility'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { notifyTourChanged } from '@/features/notifications/data/notify-dispatch'
import { ToursRepositoryImpl } from '@/features/tours/data/repositories/tours-repository-impl'
import { removeGpx } from '@/features/tours/data/services/gpx-storage-service'
import { isMeaningfulTourChange, isShareableTour } from '@/features/tours/domain/tour-notifications'

const repository = new ToursRepositoryImpl()

export const useToursStore = defineStore('tours', () => {
  const logger = useLogger('ToursStore')
  const authStore = useAuthStore()
  const contactsStore = useContactsStore()

  const tours = ref<Tour[]>([])
  const friendTours = ref<Tour[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
      return [{ event: '*', table: 'tours', filter: `user_id=eq.${uid}` }]
    },
    onChange: loadTours,
    onSubscribed: () => loadTours(),
  })

  async function loadTours() {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    isLoading.value = true
    error.value = null

    try {
      tours.value = await repository.listToursForUser(userId)
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

  // Friend tours are a separate collection. Realtime sync is deferred (issue #198);
  // callers refetch on demand (e.g. opening the Friends list tab or the map).
  async function loadFriendTours() {
    if (!authStore.currentUser?.id)
      return

    try {
      friendTours.value = await repository.listFriendTours()
    }
    catch (err) {
      logger.error('Failed to load friend tours', err)
    }
  }

  async function createTourFromDraft(
    draft: TourDraft,
    goal: { lng: number, lat: number },
    gpxFile: File | null = null,
    preUploadedTourId: string | null = null,
  ): Promise<string | null> {
    const userId = authStore.currentUser?.id
    if (!userId)
      return null

    const id = preUploadedTourId ?? uuidv4()
    await repository.createTourWithPartners(id, draft, goal)

    // Tours default to 'friends' server-side; only a non-default choice needs a write.
    if (draft.visibility && draft.visibility !== 'friends')
      await repository.patchVisibility(id, draft.visibility)

    if (gpxFile) {
      try {
        const filepath = await uploadGpx(userId, id, gpxFile)
        await repository.patchGpxFilepath(id, filepath)
      }
      catch (err) {
        logger.warn('GPX upload failed after tour creation', err)
      }
    }

    await loadTours()

    // Notify friend partners of the new shared tour (Worker filters to actual friends).
    if (isShareableTour(draft.visibility, draft.partnerIds))
      notifyTourChanged(id, 'created')

    return id
  }

  async function updateTour(
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
    gpxRemoved: boolean = false,
  ) {
    const existing = tours.value.find(t => t.id === id)
    const previousFilepath = existing?.gpxFilepath ?? null

    try {
      await repository.updateTour(id, draft, goal)
      // update_tour_full intentionally leaves visibility untouched; persist it separately
      // so an edit through the form still applies a visibility change.
      if (draft.visibility && draft.visibility !== existing?.visibility)
        await repository.patchVisibility(id, draft.visibility)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update tour'
      logger.error('updateTour failed', err)
      throw err
    }

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
      notifyTourChanged(id, 'updated')
    }
  }

  async function setCompleted(tourId: string, completed: boolean) {
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
  }

  async function setVisibility(tourId: string, visibility: Visibility) {
    const tour = tours.value.find(t => t.id === tourId)
    if (!tour)
      return

    const previous = tour.visibility
    tours.value = tours.value.map(t => (t.id === tourId ? { ...t, visibility } : t))

    try {
      await repository.patchVisibility(tourId, visibility)
    }
    catch (err) {
      tours.value = tours.value.map(t => (t.id === tourId ? { ...t, visibility: previous } : t))
      error.value = err instanceof Error ? err.message : 'Failed to update visibility'
      logger.error('setVisibility failed', err)
    }
  }

  async function deleteTour(id: string) {
    const tour = tours.value.find(t => t.id === id)
    // Dispatch BEFORE deleting so the Worker can still resolve the tour's partners
    // server-side (it reads the row). Fire-and-forget; the delete proceeds regardless.
    if (tour && isShareableTour(tour.visibility, tour.partnerIds))
      notifyTourChanged(id, 'deleted')
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
