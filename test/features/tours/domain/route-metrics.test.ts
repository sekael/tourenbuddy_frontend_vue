import { describe, expect, it } from 'vitest'
import { pointMetrics, routeMetrics, totalMetrics, trackMetrics } from '@/features/tours/domain/route-metrics'

const HUT = { lng: 9.86, lat: 46.64 }
const VALLEY = { lng: 9.81, lat: 46.64 }

function heights(overrides: object) {
  return { elevation: 3079, startPoint: HUT, startPointElevation: 2632, endPoint: null, endPointElevation: null, ...overrides }
}

function track(...lines: number[][][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lines.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
  }
}

describe('pointMetrics', () => {
  it('should climb to the goal and descend to a distinct end', () => {
    expect(pointMetrics(heights({ endPoint: VALLEY, endPointElevation: 1822 })))
      .toEqual({ ascent: 447, descent: 1257, distance: null })
  })

  it('should end at the goal when the tour has no end point', () => {
    expect(pointMetrics(heights({}))).toEqual({ ascent: 447, descent: 0, distance: null })
  })

  it('should count a goal below the start as descent (a flight down)', () => {
    expect(pointMetrics(heights({ elevation: 1707 }))).toEqual({ ascent: 0, descent: 925, distance: null })
  })

  it('should take the start height for a round trip whose end has none', () => {
    expect(pointMetrics(heights({ endPoint: { ...HUT }, endPointElevation: null })))
      .toEqual({ ascent: 447, descent: 447, distance: null })
  })

  it('should know nothing when a height is missing, rather than guess', () => {
    const unknown = { ascent: null, descent: null, distance: null }
    expect(pointMetrics(heights({ startPointElevation: null }))).toEqual(unknown)
    expect(pointMetrics(heights({ startPoint: null }))).toEqual(unknown)
    expect(pointMetrics(heights({ elevation: null }))).toEqual(unknown)
    expect(pointMetrics(heights({ endPoint: VALLEY, endPointElevation: null }))).toEqual(unknown)
  })
})

describe('trackMetrics', () => {
  it('should not turn recorder noise on a flat stretch into climb', () => {
    const noisy = [0, 3, -2, 4, 1, -3, 2].map((d, i) => [9.8 + i * 0.001, 46.6, 1800 + d])
    expect(trackMetrics(track(noisy))).toMatchObject({ ascent: 0, descent: 0 })
  })

  it('should count real swings past the threshold both ways, across track segments', () => {
    const up = [[9.8, 46.6, 1800], [9.801, 46.6, 1900], [9.802, 46.6, 1850]]
    const down = [[9.81, 46.6, 2000], [9.811, 46.6, 1700]]
    expect(trackMetrics(track(up, down))).toMatchObject({ ascent: 100, descent: 350 })
  })

  it('should give the horizontal distance and no heights for a track without them', () => {
    const m = trackMetrics(track([[9.8, 46.6], [9.8, 46.61]]))
    expect(m.ascent).toBeNull()
    expect(m.distance).toBeCloseTo(1112, -1)
  })

  it('should know nothing for a file without lines (waypoints only)', () => {
    const points: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [9.8, 46.6] } }],
    }
    expect(trackMetrics(points)).toEqual({ ascent: null, descent: null, distance: null })
  })
})

describe('routeMetrics', () => {
  it('should keep the point climb but take the distance from a track without heights', () => {
    expect(routeMetrics(heights({}), track([[9.8, 46.6], [9.8, 46.61]])))
      .toMatchObject({ ascent: 447, descent: 0, distance: expect.any(Number) })
  })
})

describe('totalMetrics', () => {
  it('should not total a number one route lacks — a partial sum misleads', () => {
    const total = totalMetrics([
      { ascent: 1265, descent: 0, distance: null },
      { ascent: null, descent: null, distance: null },
    ])
    expect(total).toEqual({ ascent: null, descent: null, distance: null })
    expect(totalMetrics([])).toEqual({ ascent: null, descent: null, distance: null })
  })
})
