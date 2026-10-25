import { describe, expect, it } from 'vitest'
import { pointMetrics, progressNearest, routeMetrics, totalMetrics, trackEnds, trackMetrics } from '@/features/tours/domain/route-metrics'

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

describe('routeMetrics of a split tour (activity-legs)', () => {
  const GOAL = { lng: 8.02, lat: 46.6 }
  // Walk up 1000 m to the goal, then fly: a 300 m thermal on the way down to 600 m.
  const hikeAndFly = track([[8, 46.6, 600], [8.01, 46.6, 1100], [8.02, 46.6, 1600], [8.03, 46.6, 1200], [8.04, 46.6, 1500], [8.05, 46.6, 600]])
  const legs = { ascent: ['hiking'], descent: ['paragliding'] } as const

  it('should count only the walk as the climb and the flight as its net drop', () => {
    expect(routeMetrics({ ...heights({}), goal: GOAL, legs: { ascent: [...legs.ascent], descent: [...legs.descent] } }, hikeAndFly))
      .toMatchObject({ ascent: 1000, descent: 1000 })
  })

  it('should measure a flown tour\'s distance on the way up only', () => {
    const tour = { ...heights({}), goal: GOAL, legs: { ascent: [...legs.ascent], descent: [...legs.descent] } }
    expect(routeMetrics(tour, hikeAndFly).distance).toBeCloseTo(routeMetrics({ ...tour, legs: null }, hikeAndFly).distance! * 2 / 5, -1)
  })

  it('should keep the whole-track numbers for an unsplit tour', () => {
    expect(routeMetrics({ ...heights({}), goal: GOAL }, hikeAndFly)).toMatchObject({ ascent: 1300, descent: 1300 })
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

describe('progressNearest', () => {
  it('should measure along the line to the vertex nearest the point', () => {
    const line = [[8, 46], [8.01, 46], [8.03, 46]]
    expect(progressNearest(line, { lng: 8.0101, lat: 46.001 })).toBeCloseTo(1 / 3, 2)
  })

  it('should be 0 for a line without length', () => {
    expect(progressNearest([[8, 46]], { lng: 9, lat: 47 })).toBe(0)
  })
})

describe('trackEnds', () => {
  it('should have no ends without a point', () => {
    expect(trackEnds({ type: 'FeatureCollection', features: [] })).toBeNull()
  })

  it('should take the first point of the first line and the last of the last, across features', () => {
    const line = (coordinates: number[][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } })
    const multi = { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: [[[3, 3, 900]], [[4, 4], [5, 5]]] } }
    expect(trackEnds({ type: 'FeatureCollection', features: [line([[1, 1], [2, 2]]), multi] }))
      .toEqual({ first: { lng: 1, lat: 1 }, last: { lng: 5, lat: 5 } })
  })
})
