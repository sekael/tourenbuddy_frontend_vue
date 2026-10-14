import type { LngLat, Map as MapLibreMap, Point } from 'maplibre-gl'
import type { Trail } from '@/features/map/domain/entities/trail'
import { useLogger } from '@/core/logging/use-logger'
import { identifySkiRoutes } from '@/features/map/data/services/swisstopo-trail-service'
import { nearestOnPolylines } from '@/features/map/domain/nearest-point'

/** Lookup only from this zoom: below it a thumb covers dozens of routes. */
export const TRAIL_LOOKUP_MIN_ZOOM = 11
export const MAX_TRAIL_CANDIDATES = 8

export interface TrailHits {
  /** Nearest first, at most `MAX_TRAIL_CANDIDATES`; empty = miss. */
  candidates: Trail[]
  more: number
}

/** Fingertip vs mouse pointer: one value is both the query tolerance and the "on the tap" rule. */
function tapTolerance(): number {
  return window.matchMedia?.('(pointer: coarse)').matches ? 24 : 10
}

/**
 * Ski-route lookup under a tap. Each call supersedes the previous one: it aborts the
 * pending request, and a result applies only if no newer call started meanwhile (an
 * abort can lose the race against an already-parsed body). Resolves `null` when
 * superseded or failed (`onError` fires for real failures, never for supersede).
 */
export function useTrailLookup(options: { map: () => MapLibreMap | null, locale: () => string, onError: () => void }) {
  const logger = useLogger('TrailLookup')
  let controller: AbortController | null = null
  let latest = 0

  /** Drop any pending lookup without starting a new one. */
  function cancel() {
    latest++
    controller?.abort()
    controller = null
  }

  async function lookup(point: Point, lngLat: LngLat): Promise<TrailHits | null> {
    const map = options.map()
    if (!map)
      return null
    cancel()
    const request = latest
    const ownController = new AbortController()
    controller = ownController

    const b = map.getBounds()
    const { clientWidth: width, clientHeight: height } = map.getContainer()
    try {
      const trails = await identifySkiRoutes({
        lngLat,
        bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        size: { width, height },
        tolerance: tapTolerance(),
        locale: options.locale(),
        signal: ownController.signal,
      })
      if (request !== latest)
        return null
      const tap = [point.x, point.y] as const
      const ranked = trails
        .map((trail) => {
          const projected = trail.lines.map(line => line.map((c) => {
            const { x, y } = map.project(c)
            return [x, y] as const
          }))
          return { trail, distance: nearestOnPolylines(tap, projected)?.distance ?? Infinity }
        })
        .sort((a, b) => a.distance - b.distance)
      return {
        candidates: ranked.slice(0, MAX_TRAIL_CANDIDATES).map(r => r.trail),
        more: Math.max(0, ranked.length - MAX_TRAIL_CANDIDATES),
      }
    }
    catch (err) {
      // Our own aborts always bump `latest` first, so they stay silent; a timeout surfaces.
      if (request !== latest)
        return null
      logger.warn('Trail lookup failed', err)
      options.onError()
      return null
    }
  }

  return { lookup, cancel }
}
