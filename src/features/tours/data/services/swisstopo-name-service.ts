import { useLogger } from '@/core/logging/use-logger'

const logger = useLogger('SwisstopoName')
const TIMEOUT_MS = 5000

interface SearchResult {
  results?: Array<{
    attrs?: {
      label?: string
      detail?: string
    }
  }>
}

/**
 * Suggests a tour name by reverse-geocoding the given WGS84 coordinates
 * via the Swisstopo GeoAdmin search API (location search by coordinates).
 *
 * Returns the closest named feature label, or null if nothing is found or
 * the API is unavailable.
 */
export async function suggestTourName(coords: {
  lng: number
  lat: number
}): Promise<string | null> {
  // GeoAdmin location search: search nearby features by lat/lon text
  const searchText = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`
  const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&searchText=${encodeURIComponent(searchText)}&limit=1`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      logger.warn('Swisstopo name API returned non-OK status', response.status)
      return null
    }

    const data = (await response.json()) as SearchResult

    const first = data.results?.[0]
    if (!first?.attrs?.label)
      return null

    // Strip HTML tags that the API sometimes returns in labels
    const label = first.attrs.label.replace(/<[^>]*>/g, '').trim()
    return label || null
  }
  catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.warn('Swisstopo name API timed out')
    }
    else {
      logger.error('Swisstopo name API error', err)
    }
    return null
  }
  finally {
    clearTimeout(timeoutId)
  }
}
