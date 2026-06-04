import type { Visibility } from '@/features/tours/data/models/visibility'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'

/** Abstract repository interface for tour data operations. */
export interface ToursRepository {
  listToursForUser: (userId: string) => Promise<Tour[]>
  /** Friend tours readable by the current user (gated for non-partner viewers). */
  listFriendTours: () => Promise<Tour[]>
  createTourWithPartners: (
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
  ) => Promise<void>
  updateTour: (id: string, draft: TourDraft, goal: { lng: number, lat: number }) => Promise<void>
  patchGpxFilepath: (id: string, filepath: string | null) => Promise<void>
  patchCompleted: (id: string, completed: boolean) => Promise<void>
  patchVisibility: (id: string, visibility: Visibility) => Promise<void>
  deleteTour: (id: string) => Promise<void>
}
