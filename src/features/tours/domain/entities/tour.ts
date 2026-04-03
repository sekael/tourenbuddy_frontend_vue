import type { z } from 'zod'
import type { tourSchema } from '@/features/tours/data/models/tour-schema'

/** Domain entity for a tour. */
export type Tour = z.infer<typeof tourSchema>

/** Draft used when creating a new tour (before location is set). */
export interface TourDraft {
  name: string | null
  plannedDate: Date | null
  partnerIds: string[]
}

/** Converts a tour to a GeoJSON Feature for MapLibre rendering. */
export function tourToGeoJsonFeature(tour: Tour): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    id: tour.id,
    geometry: {
      type: 'Point',
      coordinates: [tour.goal.lng, tour.goal.lat],
    },
    properties: {
      id: tour.id,
    },
  }
}

/** Converts an array of tours to a GeoJSON FeatureCollection. */
export function toursToGeoJson(tours: Tour[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: tours.map(tourToGeoJsonFeature),
  }
}
