import { z } from 'zod'
import { useLogger } from '@/core/logging/use-logger'

const logger = useLogger('SwisstopoSearch')
const TIMEOUT_MS = 5000
const CANDIDATES = 30
const SHOWN = 8
/** From this zoom on, the view says where the user means; below it, it doesn't. */
const PROXIMITY_MIN_ZOOM = 9

/** GeoAdmin `zoomlevel` is on swisstopo's LV95 scale, so zoom comes from the origin. */
const ORIGIN_ZOOM: Record<string, number> = {
  gazetteer: 14,
  address: 17,
  zipcode: 12,
  gg25: 12,
}
const DEFAULT_ZOOM = 13

export interface LocationResult {
  name: string
  /** Source object kind ("Alpiner Gipfel"); null for postcodes, municipalities, addresses. */
  kind: string | null
  /** "Pontresina (GR)" */
  region: string | null
  origin: string
  lng: number
  lat: number
  zoom: number
}

const entrySchema = z.object({
  attrs: z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number(),
    origin: z.string(),
  }),
})
const responseSchema = z.object({ results: z.array(z.unknown()) })

/**
 * Splits a GeoAdmin label into plain-text parts. Labels are HTML
 * (`<i>Alpiner Gipfel</i> <b>Piz Bernina</b> (GR) - Pontresina`, addresses put the street
 * before the bold locality); DOMParser decodes entities and runs nothing.
 */
export function parseLabel(label: string): Pick<LocationResult, 'name' | 'kind' | 'region'> {
  const body = new DOMParser().parseFromString(label, 'text/html').body
  const text = (node: Node | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const bold = body.querySelector('b')
  const kind = text(body.querySelector('i')) || null
  body.querySelector('i')?.remove()

  let before = ''
  let after = ''
  let node = bold ? bold.previousSibling : null
  for (; node; node = node.previousSibling) before = (node.textContent ?? '') + before
  for (node = bold?.nextSibling ?? null; node; node = node.nextSibling) after += node.textContent ?? ''

  // Addresses: "Via Pros da God # <b>7504 Pontresina</b>" — drop the stray "#".
  const street = before.replace(/#/g, '').replace(/\s+/g, ' ').trim()
  const main = bold ? text(bold) : text(body)
  const name = street ? `${street}, ${main}` : main

  // Whitespace-normalized, so the separator is exactly " - " (no backtracking-prone \s*).
  const tail = after.replace(/\s+/g, ' ').trim()
  const match = /^\(([^)]+)\) - (.+)$/.exec(tail)
  const region = match ? `${match[2]} (${match[1]})` : tail || null
  return { name, kind, region }
}

/**
 * Searches Swiss place names, summits, huts, localities, postcodes and addresses
 * (GeoAdmin SearchServer). Malformed entries are dropped. Rejects on HTTP/validation
 * failure; a timeout rejects with a `TimeoutError` DOMException, an abort through
 * `signal` with the fetch's own `AbortError` — so callers can stay silent on the latter.
 */
export async function searchLocations(query: string, lang: string, signal: AbortSignal): Promise<LocationResult[]> {
  const params = new URLSearchParams({
    type: 'locations',
    searchText: query,
    sr: '4326',
    limit: String(CANDIDATES),
    lang: lang.split('-')[0]!,
    origins: 'gazetteer,zipcode,gg25,address',
  })
  // ponytail: manual link instead of AbortSignal.any (iOS < 17.4 lacks it).
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  try {
    const response = await fetch(`https://api3.geo.admin.ch/rest/services/api/SearchServer?${params}`, {
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`Location search HTTP ${response.status}`)
    const { results } = responseSchema.parse(await response.json())
    return results.flatMap((raw) => {
      const entry = entrySchema.safeParse(raw)
      if (!entry.success)
        return []
      const { label, lat, lon, origin } = entry.data.attrs
      const parts = parseLabel(label)
      if (!parts.name)
        return []
      return [{ ...parts, origin, lng: lon, lat, zoom: ORIGIN_ZOOM[origin] ?? DEFAULT_ZOOM }]
    })
  }
  catch (err) {
    if (timedOut) {
      logger.warn('Location search timed out', { query })
      throw new DOMException('Location search timed out', 'TimeoutError')
    }
    throw err
  }
  finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

/**
 * Orders candidates for display and keeps the first 8. Keeps the service's order, but
 * from zoom 9 on lists each set of identically named places nearest-first at the
 * position of its first member — "Schwarzhorn" near the view wins, other names never move.
 */
export function rankResults(
  results: LocationResult[],
  center: { lng: number, lat: number },
  zoom: number,
): LocationResult[] {
  if (zoom < PROXIMITY_MIN_ZOOM)
    return results.slice(0, SHOWN)
  // ponytail: equirectangular distance — only the order matters, and only within Switzerland.
  const cos = Math.cos((center.lat * Math.PI) / 180)
  const dist = (r: LocationResult) => ((r.lng - center.lng) * cos) ** 2 + (r.lat - center.lat) ** 2
  const groups = new Map<string, LocationResult[]>()
  for (const r of results) groups.set(r.name, [...(groups.get(r.name) ?? []), r])
  return [...groups.values()]
    .flatMap(group => group.sort((a, b) => dist(a) - dist(b)))
    .slice(0, SHOWN)
}
