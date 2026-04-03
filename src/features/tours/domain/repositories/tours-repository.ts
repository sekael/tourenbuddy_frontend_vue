import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'

/** Abstract repository interface for tour data operations. */
export interface ToursRepository {
  listToursForUser: (userId: string) => Promise<Tour[]>
  createTourWithPartners: (
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
  ) => Promise<void>
}
