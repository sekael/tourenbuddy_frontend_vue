import { useLogger } from '@/core/logging/use-logger'
import { loadCachedBlob } from '@/core/offline/blob-cache'
import { useGpxCache } from '@/features/tours/data/services/gpx-cache'
import { parseGpxFile } from '@/features/tours/data/services/gpx-parser'
import { getSignedUrl } from '@/features/tours/data/services/gpx-storage-service'

const logger = useLogger('gpx-track-service')
/** Loads under way, so the map and the route numbers asking at once fetch and parse once. */
const inflight = new Map<string, Promise<GeoJSON.FeatureCollection | null>>()

interface TrackTour { id: string, gpxFilepath: string, updatedAt?: string | null }

/**
 * Cache key of a tour's parsed track. The GPX key is fixed per tour (`<uid>/<tourId>.gpx`, upserted
 * on replace) and the form uploads a new file before it saves the row, so the row's `updatedAt`
 * marks a new version — a replaced track never shows from the old parse. Friend tours carry no
 * `updatedAt`: theirs refreshes on reload.
 */
export function gpxTrackKey(tour: { id: string, updatedAt?: string | null }): string {
  return `${tour.id}@${tour.updatedAt ?? ''}`
}

/**
 * A tour's parsed GPX track: memory cache, else offline-first bytes (cached on first online view).
 * Null when it can't be had — offline and never cached, or a broken file.
 */
export function loadGpxTrack(tour: TrackTour): Promise<GeoJSON.FeatureCollection | null> {
  const key = gpxTrackKey(tour)
  const cached = useGpxCache().get(key)
  if (cached)
    return Promise.resolve(cached)
  const pending = inflight.get(key) ?? load(tour, key).finally(() => inflight.delete(key))
  inflight.set(key, pending)
  return pending
}

async function load(tour: TrackTour, key: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    // undefined ⇒ never cached while online and offline now → no track.
    const blob = await loadCachedBlob(tour.gpxFilepath, async () => {
      const response = await fetch(await getSignedUrl(tour.gpxFilepath))
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`)
      return response.blob()
    })
    if (!blob)
      throw new Error('GPX unavailable offline')
    const geojson = await parseGpxFile(new File([blob], `${tour.id}.gpx`, { type: 'application/gpx+xml' }))
    useGpxCache().set(key, geojson)
    return geojson
  }
  catch (err) {
    logger.error('Failed to load GPX track', err)
    return null
  }
}
