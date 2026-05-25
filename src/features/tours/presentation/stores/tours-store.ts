import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { ToursRepositoryImpl } from '@/features/tours/data/repositories/tours-repository-impl'
import { removeGpx } from '@/features/tours/data/services/gpx-storage-service'

const repository = new ToursRepositoryImpl()

export const useToursStore = defineStore('tours', () => {
  const logger = useLogger('ToursStore')
  const authStore = useAuthStore()
  const contactsStore = useContactsStore()

  const tours = ref<Tour[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  watch(
    () => authStore.isAuthenticated,
    (authed, wasAuthed) => {
      if (authed && !wasAuthed)
        loadTours()
      else if (!authed && wasAuthed)
        clear()
    },
  )

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
            goal,
          }
        : t,
    )
  }

  async function setCompleted(tourId: string, completed: boolean) {
    const tour = tours.value.find(t => t.id === tourId)
    if (!tour)
      return

    tours.value = tours.value.map(t => (t.id === tourId ? { ...t, completed } : t))
    logger.debug('setCompleted', { tourId, completed })

    try {
      await repository.patchCompleted(tourId, completed)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update tour'
      logger.error('setCompleted failed, resyncing from server', err)
      await loadTours()
    }
  }

  async function deleteTour(id: string) {
    const tour = tours.value.find(t => t.id === id)
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
    error.value = null
  }

  return {
    tours,
    isLoading,
    error,
    loadTours,
    createTourFromDraft,
    updateTour,
    setCompleted,
    deleteTour,
    clear,
  }
})
