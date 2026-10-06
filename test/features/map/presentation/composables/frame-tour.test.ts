import type { Map as MaplibreMap } from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { frameTour, TOUR_ZOOM } from '@/features/map/presentation/composables/frame-tour'

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
  frameTour(map as unknown as MaplibreMap, { goal, ...tour }, covered)
  const [bounds, options] = map.cameraForBounds.mock.calls[0] as unknown as [{ toArray: () => number[][] }, any]
  return { map, box: bounds.toArray(), options }
}

describe('frameTour', () => {
  it('should frame a lone goal as a zero-size box, capped at the tour zoom', () => {
    const { box, options } = frame({ startPoint: null, endPoint: null })
    expect(box).toEqual([[goal.lng, goal.lat], [goal.lng, goal.lat]])
    expect(options.maxZoom).toBe(TOUR_ZOOM)
  })

  it('should frame a round trip (start = end) exactly like start and goal', () => {
    expect(frame({ startPoint: start, endPoint: start }).box)
      .toEqual(frame({ startPoint: start, endPoint: null }).box)
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
    frameTour(map as unknown as MaplibreMap, { goal, startPoint: start, endPoint: null }, { bottom: 5000 })
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [goal.lng, goal.lat], zoom: TOUR_ZOOM }))
  })
})
