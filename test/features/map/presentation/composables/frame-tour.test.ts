import type { Map as MaplibreMap } from 'maplibre-gl'
import { LngLatBounds } from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { frameBounds, frameTours, ROUTE_ZOOM, TOUR_ZOOM } from '@/features/map/presentation/composables/frame-tour'

const goal = { lng: 9.7, lat: 46.6 }
const start = { lng: 9.6, lat: 46.5 }
const end = { lng: 9.8, lat: 46.7 }

function fakeMap() {
  return {
    cameraForBounds: vi.fn(() => ({ center: [0, 0], zoom: 10 })),
    flyTo: vi.fn(),
    getBearing: () => 15,
  }
}

function frame(tour: { startPoint: typeof start | null, endPoint: typeof end | null }, covered = {}) {
  const map = fakeMap()
  frameTours(map as unknown as MaplibreMap, [{ goal, ...tour }], covered)
  const [bounds, options] = map.cameraForBounds.mock.calls[0] as unknown as [{ toArray: () => number[][] }, any]
  return { map, box: bounds.toArray(), options }
}

describe('frameTours', () => {
  it('should frame a lone goal as a zero-size box, capped at the tour zoom', () => {
    const { box, options } = frame({ startPoint: null, endPoint: null })
    expect(box).toEqual([[goal.lng, goal.lat], [goal.lng, goal.lat]])
    expect(options.maxZoom).toBe(TOUR_ZOOM)
  })

  it('should frame a round trip (start = end) exactly like start and goal', () => {
    expect(frame({ startPoint: start, endPoint: start }).box)
      .toEqual(frame({ startPoint: start, endPoint: null }).box)
  })

  it('should frame every segment of an outing', () => {
    const map = fakeMap()
    frameTours(map as unknown as MaplibreMap, [
      { goal, startPoint: start, endPoint: null },
      { goal: end, startPoint: goal, endPoint: null },
    ], {})
    const [bounds] = map.cameraForBounds.mock.calls[0] as unknown as [{ toArray: () => number[][] }]
    expect(bounds.toArray()).toEqual([[start.lng, start.lat], [end.lng, end.lat]])
  })

  it('should stretch the box to a separate end point', () => {
    expect(frame({ startPoint: start, endPoint: end }).box).toEqual([[start.lng, start.lat], [end.lng, end.lat]])
  })

  it('should pad by the covered area and keep the bearing', () => {
    const { options } = frame({ startPoint: null, endPoint: null }, { bottom: 300 })
    expect(options.padding.bottom).toBeGreaterThan(300)
    expect(options.padding.top).toBeLessThan(300)
    expect(options.bearing).toBe(15)
  })

  it('should centre the goal when there is no room to frame in', () => {
    const map = fakeMap()
    map.cameraForBounds.mockReturnValue(undefined as never)
    frameTours(map as unknown as MaplibreMap, [{ goal, startPoint: start, endPoint: null }], { bottom: 5000 })
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [goal.lng, goal.lat], zoom: TOUR_ZOOM }))
  })

  it('should frame up to a raised max zoom but fall back no closer than the tour zoom', () => {
    const map = fakeMap()
    map.cameraForBounds.mockReturnValue(undefined as never)
    frameBounds(map as unknown as MaplibreMap, new LngLatBounds([start.lng, start.lat], [end.lng, end.lat]), {}, { maxZoom: ROUTE_ZOOM })
    expect((map.cameraForBounds.mock.calls[0] as unknown as [unknown, { maxZoom: number }])[1].maxZoom).toBe(ROUTE_ZOOM)
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: TOUR_ZOOM }))
  })
})
