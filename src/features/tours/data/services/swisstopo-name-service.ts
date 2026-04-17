import { useLogger } from '@/core/logging/use-logger'
import { wgs84ToLv95 } from '@/core/utils/wgs84-to-lv95'

const logger = useLogger('SwisstopoName')
const TIMEOUT_MS = 5000

/**
 * Objektart priority for swissNAMES3D features.
 * Lower number = higher priority. Features not listed default to 99.
 */
const OBJEKTART_PRIORITY: Record<string, number> = {
  'Alpiner Gipfel': 0,
  Gipfel: 1,
  Pass: 2,
  Gletscher: 3,
  Gebäude: 4,
  Gebiet: 5,
  Tal: 6,
  Gondelbahn: 7,
  'Flurname swisstopo': 8,
}

function getObjektartPriority(objektart: string | undefined): number {
  if (!objektart) return 99
  return OBJEKTART_PRIORITY[objektart] ?? 99
}

interface IdentifyFeature {
  layerBodId?: string
  attributes?: {
    name?: string
    label?: string
    objektart?: string
  }
}

interface IdentifyResult {
  results?: IdentifyFeature[]
}

/**
 * Calls the GeoAdmin identify API for a given radius (meters) around the
 * LV95 point. Returns the raw result array (may be empty).
 *
 * Formula: mapExtent=±radiusM, imageDisplay=1000×1000 → 1 px = radiusM/500 m,
 * tolerance=500 px → exactly radiusM meters search radius.
 */
async function identifyAt(
  easting: number,
  northing: number,
  radiusM: number,
  signal: AbortSignal,
): Promise<IdentifyFeature[]> {
  const params = new URLSearchParams({
    geometry: `${easting},${northing}`,
    geometryType: 'esriGeometryPoint',
    imageDisplay: '1000,1000,96',
    mapExtent: `${easting - radiusM},${northing - radiusM},${easting + radiusM},${northing + radiusM}`,
    tolerance: '500',
    layers: 'all:ch.swisstopo.swissnames3d',
    sr: '2056',
    returnGeometry: 'false',
    lang: 'de',
  })

  const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?${params}`
  logger.debug('Swisstopo identify request', { url, radiusM, easting, northing })

  const response = await fetch(url, { signal })

  if (!response.ok) {
    logger.warn('Swisstopo identify API returned non-OK status', response.status)
    return []
  }

  const data = (await response.json()) as IdentifyResult
  logger.debug('Swisstopo identify response', {
    radiusM,
    count: data.results?.length ?? 0,
    results: data.results,
  })

  return data.results ?? []
}

/**
 * Suggests a tour name by reverse-geocoding the given WGS84 coordinates
 * via the Swisstopo GeoAdmin identify API (swissNAMES3D layer).
 *
 * Strategy:
 * 1. Search within 50 m — finds features at or very near the pin.
 * 2. If empty, fall back to 500 m.
 * 3. Sort results by Objektart priority and return the name of the best match.
 *
 * Returns null if nothing is found or the API is unavailable.
 */
export async function suggestTourName(coords: {
  lng: number
  lat: number
}): Promise<string | null> {
  const { easting, northing } = wgs84ToLv95(coords.lng, coords.lat)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let results = await identifyAt(easting, northing, 50, controller.signal)

    if (results.length === 0) {
      logger.debug('Swisstopo identify: no results at 50 m, retrying at 500 m')
      results = await identifyAt(easting, northing, 500, controller.signal)
    }

    if (results.length === 0) {
      logger.debug('Swisstopo identify: no results found', { coords })
      return null
    }

    // Sort by Objektart priority, pick the best-matching feature
    const sorted = [...results].sort(
      (a, b) =>
        getObjektartPriority(a.attributes?.objektart) -
        getObjektartPriority(b.attributes?.objektart),
    )

    const best = sorted[0]!
    logger.debug('Swisstopo identify: best match', {
      name: best.attributes?.name,
      objektart: best.attributes?.objektart,
    })

    if (!best.attributes) return null

    // Prefer plain `name` field; fall back to `label` with HTML stripped
    const name = best.attributes.name?.trim()
    if (name) return name

    const label = best.attributes.label?.replace(/<[^>]*>/g, '').trim()
    return label || null
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.warn('Swisstopo identify API timed out')
    } else {
      logger.error('Swisstopo identify API error', err)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
