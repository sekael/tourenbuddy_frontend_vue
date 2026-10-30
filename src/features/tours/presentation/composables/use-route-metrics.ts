import type { MaybeRefOrGetter } from 'vue'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { computed, shallowRef, toValue, watch } from 'vue'
import { isOnline } from '@/core/offline/use-online-status'
import { loadGpxTrack } from '@/features/tours/data/services/gpx-track-service'
import { getTrackProfile } from '@/features/tours/data/services/swisstopo-profile-service'
import { routeMetrics, trackLines, trackMetrics } from '@/features/tours/domain/route-metrics'

const UNKNOWN: RouteMetrics = { ascent: null, descent: null, distance: null }

/**
 * The track with a height on every point: as it is when it has them, else with the terrain's
 * along its lines (a track drawn offline, a file without `<ele>`). As it is when the profile can't
 * be had.
 */
async function withHeights(track: GeoJSON.FeatureCollection): Promise<GeoJSON.FeatureCollection> {
  if (trackMetrics(track).ascent !== null || !isOnline.value)
    return track
  const lines = trackLines(track).filter(line => line.length > 1)
  const profiles = await Promise.all(lines.map(line => getTrackProfile(line.map(([lng, lat]) => [lng!, lat!] as LngLat))))
  if (profiles.length === 0 || profiles.some(p => !p || p.heights.includes(null)))
    return track
  return {
    type: 'FeatureCollection',
    features: profiles.map(p => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: p!.line.map(([lng, lat], i) => [lng, lat, p!.heights[i]!]) },
    })),
  }
}

/**
 * Route numbers per tour id (design D19): a tour with a track counts its track — the most exact
 * the tour has, given the terrain's heights when it has none of its own. While the track loads its
 * numbers stay unknown rather than showing the start-goal-end estimate first; only a track that
 * can't be had falls back to the point heights. Tracks are held per GPX path, so a replaced track
 * (a new path) reloads.
 */
export function useRouteMetrics(tours: MaybeRefOrGetter<Tour[]>) {
  const tracks = shallowRef(new Map<string, GeoJSON.FeatureCollection>())
  /** Paths whose track couldn't be had this time (offline and never cached, a broken file). */
  const failed = shallowRef(new Set<string>())

  watch(
    () => toValue(tours).filter(t => t.gpxFilepath && !tracks.value.has(t.gpxFilepath)),
    (missing) => {
      for (const tour of missing as (Tour & { gpxFilepath: string })[]) {
        void loadGpxTrack(tour).then(async (track) => {
          const path = tour.gpxFilepath
          // A failed load stays missing, so the next change retries it — as the map does.
          if (!track) {
            failed.value = new Set(failed.value).add(path)
            return
          }
          tracks.value = new Map(tracks.value).set(path, await withHeights(track))
          if (failed.value.has(path)) {
            const rest = new Set(failed.value)
            rest.delete(path)
            failed.value = rest
          }
        })
      }
    },
    { immediate: true },
  )

  return computed(() => new Map<string, RouteMetrics>(toValue(tours).map((t) => {
    if (!t.gpxFilepath)
      return [t.id, routeMetrics(t)]
    const track = tracks.value.get(t.gpxFilepath)
    if (track)
      return [t.id, routeMetrics(t, track)]
    return [t.id, failed.value.has(t.gpxFilepath) ? routeMetrics(t) : UNKNOWN]
  })))
}
