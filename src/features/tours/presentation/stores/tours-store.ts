import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { ToursRepositoryImpl } from '@/features/tours/data/repositories/tours-repository-impl'

const repository = new ToursRepositoryImpl()

export const useToursStore = defineStore('tours', () => {
  const logger = useLogger('ToursStore')
  const authStore = useAuthStore()

  const tours = ref<Tour[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadTours() {
    const userId = authStore.currentUser?.id
    if (!userId) return

    isLoading.value = true
    error.value = null

    try {
      tours.value = await repository.listToursForUser(userId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tours'
      error.value = message
      logger.error('Failed to load tours', err)
    } finally {
      isLoading.value = false
    }
  }

  async function createTourFromDraft(draft: TourDraft, goal: { lng: number; lat: number }) {
    const userId = authStore.currentUser?.id
    if (!userId) return

    const id = uuidv4()
    await repository.createTourWithPartners(id, draft, goal)
    await loadTours()
  }

  async function updateTour(id: string, draft: TourDraft, goal: { lng: number; lat: number }) {
    await repository.updateTour(id, draft, goal)
    const existing = tours.value.find((t) => t.id === id)
    if (!existing) return
    tours.value = tours.value.map((t) =>
      t.id === id
        ? {
            ...existing,
            name: draft.name,
            plannedDate: draft.plannedDate,
            partnerIds: draft.partnerIds,
            tourType: draft.tourType,
            elevation: draft.elevation,
            gpxTrack: draft.gpxTrack,
            description: draft.description,
            seasons: draft.seasons,
            startPoint: draft.startPoint,
            endPoint: draft.endPoint,
            equipment: draft.equipment,
            notes: draft.notes,
            goal,
          }
        : t,
    )
  }

  async function deleteTour(id: string) {
    await repository.deleteTour(id)
    tours.value = tours.value.filter((t) => t.id !== id)
  }

  function clear() {
    tours.value = []
    error.value = null
  }

  return { tours, isLoading, error, loadTours, createTourFromDraft, updateTour, deleteTour, clear }
})
