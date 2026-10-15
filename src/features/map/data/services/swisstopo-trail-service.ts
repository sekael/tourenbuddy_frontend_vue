import type { LngLat, SkiRouteInfo, Trail } from '@/features/map/domain/entities/trail'
import { z } from 'zod'
import { TRAIL_OVERLAYS } from '@/features/map/data/trail-overlays'

// A whole viewport is a few hundred KB; give slow mountain connections room.
const TIMEOUT_MS = 10000
const SKI_LAYER = TRAIL_OVERLAYS.find(o => o.id === 'ski')!.layerBodId

const position = z.tuple([z.number(), z.number()]).rest(z.number())
// Swisstopo mixes numbers and numeric strings ("780") across these fields.
const num = z.union([z.number(), z.string()]).nullish()
const str = z.string().nullish()

const featureSchema = z.object({
  id: z.union([z.string(), z.number()]),
  geometry: z.discriminatedUnion('type', [
    z.object({ type: z.literal('LineString'), coordinates: z.array(position) }),
    z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(position)) }),
  ]),
  properties: z.record(z.string(), z.unknown()),
})

const responseSchema = z.object({ results: z.array(featureSchema) })

const propsSchema = z.object({
  target_name: str,
  target_altitude: num,
  name: str,
  ascent_time_label: str,
  ascent_altitude: num,
  descent_altitude: num,
}).passthrough()

type Feature = z.infer<typeof featureSchema>

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null || v === '')
    return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Swisstopo localizes as `<field>_<de|fr|it|en>`; missing translations fall back to `fallback`. */
function localized(props: Record<string, unknown>, field: string, lang: string, fallback?: string | null) {
  const value = props[`${field}_${lang}`]
  return typeof value === 'string' && value ? value : (fallback ?? null)
}

export function mapSkiRoute(feature: Feature, lang: string): Trail {
  const { geometry } = feature
  const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
  const lines = parts.map(line => line.map(([lng, lat]) => [lng, lat] as LngLat))

  const p = propsSchema.parse(feature.properties)
  const route: SkiRouteInfo | null = p.target_name == null
    ? null
    : {
        name: localized(p, 'name', lang, p.name),
        targetName: p.target_name,
        targetAltitude: toNumber(p.target_altitude),
        difficulty: localized(p, 'difficulty', lang, localized(p, 'difficulty', 'de')),
        ascentTime: p.ascent_time_label ?? null,
        ascentM: toNumber(p.ascent_altitude),
        descentM: toNumber(p.descent_altitude),
        sacUrl: localized(p, 'url_sac', lang, localized(p, 'url_sac', 'de')),
      }
  return { overlay: 'ski', id: String(feature.id), lines, route }
}

export interface IdentifyParams {
  /** Viewport as [west, south, east, north]. */
  bounds: [number, number, number, number]
  size: { width: number, height: number }
  /** UI locale, e.g. `de-CH` or `en`. */
  locale: string
  signal: AbortSignal
}

/**
 * Every ski route crossing the viewport, with full geometry, via the GeoAdmin
 * identify API. Rejects on network/HTTP/validation failure, timeout and abort.
 */
export async function identifySkiRoutes(params: IdentifyParams): Promise<Trail[]> {
  const { bounds, size, locale, signal } = params
  const lang = locale.split('-')[0]!
  const extent = bounds.join(',')
  const query = new URLSearchParams({
    geometryType: 'esriGeometryEnvelope',
    geometry: extent,
    sr: '4326',
    mapExtent: extent,
    imageDisplay: `${Math.round(size.width)},${Math.round(size.height)},96`,
    tolerance: '0',
    layers: `all:${SKI_LAYER}`,
    geometryFormat: 'geojson',
    returnGeometry: 'true',
    lang,
  })

  // ponytail: manual link instead of AbortSignal.any (iOS < 17.4 lacks it).
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort)
  const timer = setTimeout(abort, TIMEOUT_MS)
  try {
    const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?${query}`
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok)
      throw new Error(`Swisstopo identify HTTP ${response.status}`)
    const { results } = responseSchema.parse(await response.json())
    return results.map(f => mapSkiRoute(f, lang))
  }
  finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
