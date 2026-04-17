import type { z } from 'zod'
import type { Season } from '@/features/tours/data/models/season'
import type { tourSchema } from '@/features/tours/data/models/tour-schema'
import type { TourType } from '@/features/tours/data/models/tour-type'

/** Domain entity for a tour. */
export type Tour = z.infer<typeof tourSchema>

/** Draft used when creating a new tour (before location is set). */
export interface TourDraft {
  name: string | null
  plannedDate: Date | null
  partnerIds: string[]
  tourType: TourType | null
  elevation: number | null
  gpxTrack: GeoJSON.FeatureCollection | null
  description: string | null
  seasons: Season[] | null
  startPoint: { lng: number, lat: number } | null
  endPoint: { lng: number, lat: number } | null
  equipment: string | null
  notes: string | null
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
      tourType: tour.tourType ?? null,
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
