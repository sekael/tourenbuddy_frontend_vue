import type { z } from 'zod'
import type { Season } from '@/features/tours/data/models/season'
import type { tourSchema } from '@/features/tours/data/models/tour-schema'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Visibility } from '@/features/tours/data/models/visibility'

/** Domain entity for a tour. */
export type Tour = z.infer<typeof tourSchema>

/** Draft used when creating a new tour (before location is set). */
export interface TourDraft {
  name: string | null
  plannedDate: Date | null
  partnerIds: string[]
  tourType: TourType | null
  elevation: number | null
  gpxFilepath: string | null
  description: string | null
  seasons: Season[] | null
  startPoint: { lng: number, lat: number } | null
  endPoint: { lng: number, lat: number } | null
  startPointName: string | null
  startPointElevation: number | null
  endPointName: string | null
  endPointElevation: number | null
  equipment: string | null
  notes: string | null
  completed?: boolean
  /** Owner-chosen visibility. Defaults to `friends` server-side when omitted. */
  visibility?: Visibility
}

/** Converts a tour to a GeoJSON Feature for MapLibre rendering. */
export function tourToGeoJsonFeature(
  tour: Tour,
  opts?: { linkedTourIds?: Set<string> },
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    id: tour.id,
    geometry: {
      type: 'Point',
      coordinates: [tour.goal.lng, tour.goal.lat],
    },
    properties: {
      id: tour.id,
      tourType: tour.tourType ?? null,
      completed: tour.completed,
      isFriendTour: tour.isFriendTour ?? false,
      isLinked: opts?.linkedTourIds?.has(tour.id) ?? false,
    },
  }
}

/** Converts an array of tours to a GeoJSON FeatureCollection. */
export function toursToGeoJson(
  tours: Tour[],
  opts?: { linkedTourIds?: Set<string> },
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: tours.map(t => tourToGeoJsonFeature(t, opts)),
  }
}
