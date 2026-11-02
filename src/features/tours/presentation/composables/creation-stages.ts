import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import type { PointChange } from '@/features/tours/presentation/composables/use-swisstopo-fill'

/** One stage (one day) of a tour being created (map-first-tour-creation D4). */
export interface CreationStage {
  /** Stable for the stage's life: its form stays mounted under it. */
  key: string
  goal: { lng: number, lat: number }
  /** The form's first values: the next day's seed, a planned ski route's facts. */
  seed: TourDraft | null
  /** The latest points for the form (a new list per hand-over). */
  picks: PointChange[] | null
  /** The latest drawing (or a planned route's line) for the form to take as its track. */
  drawnTrack: DrawnTrack | null
}

/** What saving one stage sends. */
export interface StagePayload {
  draft: TourDraft
  goal: { lng: number, lat: number }
  preUploadedTourId: string | null
  draftId: string
}
