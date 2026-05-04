import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { ToursRepositoryImpl } from '@/features/tours/data/repositories/tours-repository-impl'
import { removeGpx, uploadGpx } from '@/features/tours/data/services/gpx-storage-service'

const repository = new ToursRepositoryImpl()

export const useToursStore = defineStore('tours', () => {
  const logger = useLogger('ToursStore')
  const authStore = useAuthStore()
  const contactsStore = useContactsStore()

  const tours = ref<Tour[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
    gpxFile: File | null = null,
    gpxRemoved: boolean = false,
  ) {
    const userId = authStore.currentUser?.id
    let uploadedFilepath: string | null = null

    if (gpxFile && userId) {
      try {
        uploadedFilepath = await uploadGpx(userId, id, gpxFile)
      }
      catch (err) {
        logger.warn('GPX upload failed during tour update', err)
      }
    }
    else if (gpxRemoved) {
      const existing = tours.value.find(t => t.id === id)
      if (existing?.gpxFilepath) {
        try {
          await removeGpx(existing.gpxFilepath)
        }
        catch (err) {
          logger.warn('GPX remove failed during tour update (trigger is fallback)', err)
        }
      }
    }

    await repository.updateTour(id, draft, goal)

    const existing = tours.value.find(t => t.id === id)
    if (!existing)
      return

    const newFilepath = gpxFile ? uploadedFilepath : gpxRemoved ? null : draft.gpxFilepath

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

    const previous = tour.completed
    tours.value = tours.value.map(t => (t.id === tourId ? { ...t, completed } : t))
    logger.debug('setCompleted', { tourId, completed })

    try {
      await repository.patchCompleted(tourId, completed)
    }
    catch (err) {
      tours.value = tours.value.map(t => (t.id === tourId ? { ...t, completed: previous } : t))
      error.value = err instanceof Error ? err.message : 'Failed to update tour'
      logger.error('setCompleted failed, rolled back', err)
    }
  }

  async function deleteTour(id: string) {
    const tour = tours.value.find(t => t.id === id)
    if (tour?.gpxFilepath) {
      try {
        await removeGpx(tour.gpxFilepath)
      }
      catch (err) {
        logger.warn('GPX remove failed before tour delete (trigger is fallback)', err)
      }
    }
    await repository.deleteTour(id)
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
