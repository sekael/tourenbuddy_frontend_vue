import { useLogger } from '@/core/logging/use-logger'
import { loadCachedBlob } from '@/core/offline/blob-cache'
import { useGpxCache } from '@/features/tours/data/services/gpx-cache'
import { parseGpxFile } from '@/features/tours/data/services/gpx-parser'
import { getSignedUrl } from '@/features/tours/data/services/gpx-storage-service'

const logger = useLogger('gpx-track-service')
/** Loads under way, so the map and the route numbers asking at once fetch and parse once. */
const inflight = new Map<string, Promise<GeoJSON.FeatureCollection | null>>()

interface TrackTour { id: string, gpxFilepath: string }

/**
 * A tour's parsed GPX track: memory cache, else offline-first bytes (cached on first online view).
 * Null when it can't be had — offline and never cached, or a broken file.
 *
 * Cached by storage path: every GPX file lands at a path of its own and is never rewritten (a
 * pick mints a fresh key, an accepted suggestion copies to one), so a replaced track is a new
 * path and a row-only write (completed, visibility) keeps the parse — no reload, no blink.
 */
export function loadGpxTrack(tour: TrackTour): Promise<GeoJSON.FeatureCollection | null> {
  const key = tour.gpxFilepath
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
