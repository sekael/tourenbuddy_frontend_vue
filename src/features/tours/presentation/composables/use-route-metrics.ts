import type { MaybeRefOrGetter } from 'vue'
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { computed, shallowRef, toValue, watch } from 'vue'
import { gpxTrackKey, loadGpxTrack } from '@/features/tours/data/services/gpx-track-service'
import { routeMetrics } from '@/features/tours/domain/route-metrics'

/**
 * Route numbers per tour id (design D19): from each tour's GPX track once it has loaded (the
 * map's own cache, so usually already there), else from its point heights. Tracks are held per
 * version (`gpxTrackKey`), so a replaced track reloads.
 */
export function useRouteMetrics(tours: MaybeRefOrGetter<Tour[]>) {
  const tracks = shallowRef(new Map<string, GeoJSON.FeatureCollection | null>())

  watch(
    () => toValue(tours).filter(t => t.gpxFilepath && !tracks.value.has(gpxTrackKey(t))),
    (missing) => {
      for (const tour of missing) {
        void loadGpxTrack(tour as Tour & { gpxFilepath: string }).then((track) => {
          tracks.value = new Map(tracks.value).set(gpxTrackKey(tour), track)
        })
      }
    },
    { immediate: true },
  )

  return computed(() => new Map<string, RouteMetrics>(
    toValue(tours).map(t => [t.id, routeMetrics(t, t.gpxFilepath ? tracks.value.get(gpxTrackKey(t)) : null)]),
  ))
}
