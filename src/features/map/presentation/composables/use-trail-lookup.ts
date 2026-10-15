import type { Map as MapLibreMap, Point } from 'maplibre-gl'
import type { Trail } from '@/features/map/domain/entities/trail'
import { shallowRef } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { identifySkiRoutes } from '@/features/map/data/services/swisstopo-trail-service'
import { nearestOnPolylines } from '@/features/map/domain/nearest-point'

/**
 * Clickable routes load from this zoom. A viewport of ski routes costs a few hundred
 * KB here (Swisstopo sends it uncompressed, all four languages) and grows ~4× per
 * level out, so no lower.
 */
export const TRAIL_LOOKUP_MIN_ZOOM = 12
export const MAX_TRAIL_CANDIDATES = 8

export interface TrailHits {
  /** Nearest first, at most `MAX_TRAIL_CANDIDATES`; empty = miss. */
  candidates: Trail[]
  more: number
}

type Bounds = [number, number, number, number]
type LoadResult = 'ok' | 'stale' | 'error'

/** Fingertip vs mouse pointer: how far from a route a tap still counts. */
function tapTolerance(): number {
  return window.matchMedia?.('(pointer: coarse)').matches ? 24 : 10
}

function contains(outer: Bounds, inner: Bounds): boolean {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3]
}

/**
 * Ski routes with route information in the current viewport: the set the map marks
 * as clickable, and the only set a tap can hit. `refresh()` loads them once per
 * settled view (no request while the view stays inside the loaded extent); a newer
 * view aborts the pending load. Taps resolve locally against the loaded set.
 */
export function useTrailLookup(options: { map: () => MapLibreMap | null, locale: () => string, onError: () => void }) {
  const logger = useLogger('TrailLookup')
  const trails = shallowRef<Trail[]>([])
  let loaded: { bounds: Bounds, result: Promise<LoadResult> } | null = null
  let controller: AbortController | null = null

  /** Drop the loaded routes and any pending load (overlay off, zoomed out, offline). */
  function clear() {
    controller?.abort()
    controller = null
    loaded = null
    trails.value = []
  }

  function refresh(): Promise<LoadResult> {
    const map = options.map()
    if (!map)
      return Promise.resolve('stale')
    const b = map.getBounds()
    const bounds: Bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    if (loaded && contains(loaded.bounds, bounds))
      return loaded.result

    controller?.abort()
    const own = new AbortController()
    controller = own
    const { clientWidth: width, clientHeight: height } = map.getContainer()
    const result = identifySkiRoutes({ bounds, size: { width, height }, locale: options.locale(), signal: own.signal })
      .then((list): LoadResult => {
        if (controller !== own)
          return 'stale'
        trails.value = list.filter(t => t.route !== null)
        return 'ok'
      })
      .catch((err): LoadResult => {
        if (controller !== own)
          return 'stale'
        logger.warn('Loading ski routes failed', err)
        loaded = null
        return 'error'
      })
    loaded = { bounds, result }
    return result
  }

  /** Routes within tap tolerance, nearest first. Waits for the view's load if pending. */
  async function lookup(point: Point): Promise<TrailHits | null> {
    const result = await refresh()
    const map = options.map()
    if (result === 'error')
      options.onError()
    if (result !== 'ok' || !map)
      return null

    const tap = [point.x, point.y] as const
    const tolerance = tapTolerance()
    const ranked = trails.value
      .map((trail) => {
        const projected = trail.lines.map(line => line.map((c) => {
          const { x, y } = map.project(c)
          return [x, y] as const
        }))
        return { trail, distance: nearestOnPolylines(tap, projected)?.distance ?? Infinity }
      })
      .filter(r => r.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance)
    return {
      candidates: ranked.slice(0, MAX_TRAIL_CANDIDATES).map(r => r.trail),
      more: Math.max(0, ranked.length - MAX_TRAIL_CANDIDATES),
    }
  }

  return { trails, refresh, lookup, clear }
}
