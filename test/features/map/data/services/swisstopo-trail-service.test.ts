import { afterEach, describe, expect, it, vi } from 'vitest'
import { identifySkiRoutes, mapSkiRoute } from '@/features/map/data/services/swisstopo-trail-service'

const NO_INFO = { target_name: null, name: 'Keine Routeninfo verfügbar', name_en: 'No route information available' }

function feature(geometry: unknown, properties: Record<string, unknown> = NO_INFO) {
  return { id: '{abc}', geometry, properties } as Parameters<typeof mapSkiRoute>[0]
}

const params = {
  bounds: [8, 46, 9, 47] as [number, number, number, number],
  size: { width: 400, height: 800 },
  locale: 'de-CH',
  signal: new AbortController().signal,
}

describe('mapSkiRoute', () => {
  it('should keep every part of a MultiLineString as its own line, dropping altitude', () => {
    const trail = mapSkiRoute(feature({ type: 'MultiLineString', coordinates: [[[8, 46, 1200], [8.1, 46.1]], [[9, 47], [9.1, 47.1]]] }), 'en')
    expect(trail.lines).toEqual([[[8, 46], [8.1, 46.1]], [[9, 47], [9.1, 47.1]]])
  })

  it('should map a route without target to route: null', () => {
    expect(mapSkiRoute(feature({ type: 'LineString', coordinates: [[8, 46], [8.1, 46.1]] }), 'en').route).toBeNull()
  })

  it('should fall back to the original text when the UI language is missing', () => {
    const trail = mapSkiRoute(feature({ type: 'LineString', coordinates: [[8, 46], [8.1, 46.1]] }, {
      target_name: 'Alpelenhörnli',
      target_altitude: 2024,
      name: 'Vom Skigebiet Engelberg',
      name_de: 'Vom Skigebiet Engelberg',
      name_en: null,
      difficulty_de: 'WS+',
      ascent_altitude: '780',
      url_sac_de: 'https://sac/de',
    }), 'en')
    expect(trail.route).toMatchObject({
      name: 'Vom Skigebiet Engelberg',
      difficulty: 'WS+',
      ascentM: 780,
      descentM: null,
      sacUrl: 'https://sac/de',
    })
  })
})

describe('identifySkiRoutes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('should reject a response that fails validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ id: 1, geometry: { type: 'Point', coordinates: [8, 46] }, properties: {} }] }))))
    await expect(identifySkiRoutes(params)).rejects.toThrow()
  })

  it('should reject a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    await expect(identifySkiRoutes(params)).rejects.toThrow('500')
  })
})
