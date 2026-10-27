import type { MaybeRefOrGetter } from 'vue'
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { computed, shallowRef, toValue, watch } from 'vue'
import { loadGpxTrack } from '@/features/tours/data/services/gpx-track-service'
import { routeMetrics } from '@/features/tours/domain/route-metrics'

/**
 * Route numbers per tour id (design D19): from each tour's GPX track once it has loaded (the
 * map's own cache, so usually already there), else from its point heights. Tracks are held per
 * GPX path, so a replaced track (a new path) reloads.
 */
export function useRouteMetrics(tours: MaybeRefOrGetter<Tour[]>) {
  const tracks = shallowRef(new Map<string, GeoJSON.FeatureCollection>())

  watch(
    () => toValue(tours).filter(t => t.gpxFilepath && !tracks.value.has(t.gpxFilepath)),
    (missing) => {
      for (const tour of missing as (Tour & { gpxFilepath: string })[]) {
        void loadGpxTrack(tour).then((track) => {
          // A failed load stays missing, so the next change retries it — as the map does.
          if (track)
            tracks.value = new Map(tracks.value).set(tour.gpxFilepath, track)
        })
      }
    },
    { immediate: true },
  )

  return computed(() => new Map<string, RouteMetrics>(
    toValue(tours).map(t => [t.id, routeMetrics(t, t.gpxFilepath ? tracks.value.get(t.gpxFilepath) : null)]),
  ))
}
