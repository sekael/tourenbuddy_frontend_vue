import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { describe, expect, it, vi } from 'vitest'
import { loadCachedBlob } from '@/core/offline/blob-cache'
import { darkenHex } from '@/core/utils/color'
import { trackGradient, useGpxTrackLayer } from '@/features/map/presentation/components/gpx-track-layer'
import { useGpxCache } from '@/features/map/presentation/composables/use-gpx-cache'
import { TOUR_TYPE_COLORS, TOUR_TYPE_TRACK_COLORS } from '@/features/tours/data/models/tour-type'

vi.mock('@/core/offline/blob-cache', () => ({ loadCachedBlob: vi.fn() }))
vi.mock('@/features/tours/data/services/gpx-storage-service', () => ({ getSignedUrl: vi.fn() }))
vi.mock('@/features/tours/data/services/gpx-parser', () => ({
  parseGpxFile: vi.fn(async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { late: true } }] })),
}))

function hexToLightness(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

describe('tOUR_TYPE_TRACK_COLORS', () => {
  it('should have an entry for every TOUR_TYPE_COLORS key', () => {
    for (const type of Object.keys(TOUR_TYPE_COLORS)) {
      expect(TOUR_TYPE_TRACK_COLORS).toHaveProperty(type)
    }
  })

  it('track color should be darker than marker color for every tour type', () => {
    for (const [type, markerColor] of Object.entries(TOUR_TYPE_COLORS)) {
      const trackColor = TOUR_TYPE_TRACK_COLORS[type as keyof typeof TOUR_TYPE_TRACK_COLORS]
      expect(hexToLightness(trackColor)).toBeLessThan(hexToLightness(markerColor))
    }
  })

  it('track colors should be approximately 18pp darker than marker colors', () => {
    for (const [type, markerColor] of Object.entries(TOUR_TYPE_COLORS)) {
      const expected = darkenHex(markerColor, 18)
      const actual = TOUR_TYPE_TRACK_COLORS[type as keyof typeof TOUR_TYPE_TRACK_COLORS]
      const diffL = Math.abs(hexToLightness(actual) - hexToLightness(expected))
      expect(diffL).toBeLessThan(0.02)
    }
  })
})

describe('trackGradient', () => {
  const stops = (colors: string[]) => (trackGradient(colors) as unknown[]).slice(3)

  it('renders an untyped track in the fallback colour', () => {
    expect(stops([])).toEqual([0, '#555555', 1, '#555555'])
  })

  it('renders a single colour solid, with no bands', () => {
    expect(stops(['#0c396d'])).toEqual([0, '#0c396d', 1, '#0c396d'])
  })

  it('bands two colours with strictly ascending stops from 0 to 1', () => {
    const s = stops(['#0c396d', '#8f1717'])
    const inputs = s.filter((_, i) => i % 2 === 0) as number[]
    expect(inputs[0]).toBe(0)
    expect(inputs.at(-1)).toBe(1)
    expect(inputs.every((v, i) => i === 0 || v > inputs[i - 1]!)).toBe(true)
    // Alternates: band 1 blue, band 2 red, ... — a fade, not one hard switch halfway.
    expect(s.filter((_, i) => i % 2 === 1).slice(0, 4)).toEqual(['#0c396d', '#0c396d', '#8f1717', '#8f1717'])
  })
})

describe('useGpxTrackLayer — several tracks (#338)', () => {
  const EMPTY = { type: 'FeatureCollection', features: [] }
  const track = (name: string) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name } }] }) as unknown as GeoJSON.FeatureCollection
  const tour = (id: string) => ({ id, gpxFilepath: `u/${id}.gpx`, tourTypes: ['hiking'] }) as unknown as Tour

  function stubMap() {
    const sources: Record<string, { setData: ReturnType<typeof vi.fn> }> = {}
    return {
      addSource: vi.fn((id: string) => { sources[id] = { setData: vi.fn() } }),
      getSource: vi.fn((id: string) => sources[id]),
      addLayer: vi.fn(),
      getLayer: vi.fn(() => null),
      setPaintProperty: vi.fn(),
      lastData: (id: string) => sources[id]?.setData.mock.calls.at(-1)?.[0],
    }
  }

  it('should draw one slot per track and dim the segments that are not open', async () => {
    useGpxCache().set('a', track('a'))
    useGpxCache().set('b', track('b'))
    const map = stubMap()
    const layer = useGpxTrackLayer(map as unknown as MapLibreMap)
    layer.setup()
    await layer.updateTracks([{ tour: tour('a'), dimmed: false }, { tour: tour('b'), dimmed: true }])

    expect(map.lastData('gpx-track-0')).toEqual(track('a'))
    expect(map.lastData('gpx-track-1')).toEqual(track('b'))
    expect(map.setPaintProperty).toHaveBeenCalledWith('gpx-track-line-1', 'line-opacity', 0.4)
    expect(map.setPaintProperty).toHaveBeenCalledWith('gpx-track-line-0', 'line-opacity', 0.85)
  })

  it('should not draw a track that finishes loading after the selection moved on', async () => {
    let finish!: (blob: Blob) => void
    const pending = new Promise<Blob>((resolve) => {
      finish = resolve
    })
    vi.mocked(loadCachedBlob).mockReturnValueOnce(pending)
    const map = stubMap()
    const layer = useGpxTrackLayer(map as unknown as MapLibreMap)
    layer.setup()

    const slow = layer.updateTracks([{ tour: tour('slow'), dimmed: false }])
    await layer.updateTracks([])
    finish(new Blob(['<gpx/>']))
    await slow

    expect(map.lastData('gpx-track-0')).toEqual(EMPTY)
  })
})
