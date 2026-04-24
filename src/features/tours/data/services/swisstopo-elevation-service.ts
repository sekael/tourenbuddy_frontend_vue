import { useLogger } from '@/core/logging/use-logger'
import { wgs84ToLv95 } from '@/core/utils/wgs84-to-lv95'

const logger = useLogger('SwisstopoElevation')
const TIMEOUT_MS = 5000

/**
 * Retrieves elevation in meters at the given WGS84 coordinates using the
 * Swisstopo height REST API (EPSG:2056 / LV95).
 *
 * Returns the elevation rounded to the nearest meter, or null if the API is
 * unavailable, times out, or the location is outside Swiss territory.
 */
export async function getElevation(coords: { lng: number; lat: number }): Promise<number | null> {
  const { easting, northing } = wgs84ToLv95(coords.lng, coords.lat)
  const url = `https://api3.geo.admin.ch/rest/services/height?easting=${easting.toFixed(2)}&northing=${northing.toFixed(2)}&sr=2056`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      logger.warn('Swisstopo elevation API returned non-OK status', response.status)
      return null
    }

    const data = (await response.json()) as { height?: number | string }

    if (data.height == null || data.height === 'None') {
      return null
    }

    const height = Number(data.height)
    return Number.isFinite(height) ? Math.round(height) : null
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.warn('Swisstopo elevation API timed out')
    } else {
      logger.error('Swisstopo elevation API error', err)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
