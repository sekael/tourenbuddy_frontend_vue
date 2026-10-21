import type { Tour } from '@/features/tours/domain/entities/tour'
import { describe, expect, it } from 'vitest'
import {
  appendedOuting,
  nextSegmentSeed,
  outingDisplayName,
  outingKey,
  outingSegments,
  outingSpan,
} from '@/features/tours/domain/outing'
import { TOUR_FILL } from '../../../fixtures/tour-fill'

const OUTING = 'o1'

function tour(overrides: Partial<Tour>): Tour {
  return {
    ...TOUR_FILL,
    id: 't',
    userId: 'me',
    plannedDate: null,
    goal: { lng: 7.5, lat: 46 },
    name: 'Tour',
    partnerIds: [],
    tourTypes: [],
    elevation: null,
    gpxFilepath: null,
    description: null,
    seasons: null,
    startPoint: null,
    endPoint: null,
    equipment: null,
    notes: null,
    completed: false,
    ...overrides,
  }
}

function segment(id: string, position: number, extra: Partial<Tour> = {}) {
  return tour({ id, outing: { id: OUTING, name: null, position }, ...extra })
}

describe('outingSegments', () => {
  it('should order by position, then id when two offline edits picked the same position', () => {
    const tours = [segment('c', 5), segment('b', 0), segment('a', 0)]
    expect(outingSegments(tours, outingKey(tours[0]!)).map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('should not pull a friend\'s tour carrying a copied outing id into the outing', () => {
    const tours = [segment('a', 0), segment('b', 1), segment('x', 2, { userId: 'friend' })]
    expect(outingSegments(tours, outingKey(tours[0]!)).map(t => t.id)).toEqual(['a', 'b'])
  })

  it('should treat a lone visible segment as no outing', () => {
    expect(outingSegments([segment('a', 0), tour({ id: 'b' })], `me/${OUTING}`)).toEqual([])
  })

  it('should return no segments for a standalone tour', () => {
    expect(outingKey(tour({}))).toBeNull()
    expect(outingSegments([tour({})], null)).toEqual([])
  })
})

describe('outingDisplayName', () => {
  it('should fall back to the first segment\'s name when the outing has none', () => {
    expect(outingDisplayName([segment('a', 0, { name: 'Hut' }), segment('b', 1)])).toBe('Hut')
  })
})

describe('outingSpan', () => {
  it('should span from the earliest day to the latest end day across segments', () => {
    const span = outingSpan([
      segment('a', 0, { plannedDate: new Date('2027-03-13') }),
      segment('b', 1, { plannedDate: new Date('2027-03-12'), endDate: new Date('2027-03-15') }),
      segment('c', 2),
    ])
    expect(span).toEqual({ start: new Date('2027-03-12'), end: new Date('2027-03-15') })
  })

  it('should be null when no segment is dated', () => {
    expect(outingSpan([segment('a', 0), segment('b', 1)])).toBeNull()
  })
})

describe('appendedOuting', () => {
  it('should append after the highest position, gaps included', () => {
    const outing = { id: OUTING, name: 'Route', position: 0 }
    expect(appendedOuting(outing, [segment('a', 0), segment('b', 4)]).position).toBe(5)
  })
})

describe('nextSegmentSeed', () => {
  it('should start at the previous segment\'s end point on its last day', () => {
    const seed = nextSegmentSeed(segment('a', 0, {
      plannedDate: new Date('2027-03-11'),
      endDate: new Date('2027-03-12'),
      endPoint: { lng: 7.6, lat: 46.1 },
      endPointName: 'Cabane de Bertol',
      endPointElevation: 3311,
      tourTypes: ['skitour'],
    }))
    expect(seed).toMatchObject({
      plannedDate: new Date('2027-03-12'),
      startPoint: { lng: 7.6, lat: 46.1 },
      startPointName: 'Cabane de Bertol',
      startPointElevation: 3311,
      tourTypes: ['skitour'],
      name: null,
      endPoint: null,
    })
  })

  it('should start at the goal with a whole-metre elevation when the previous segment has no end point', () => {
    const seed = nextSegmentSeed(segment('a', 0, { name: 'Hut', elevation: 2632.4 }))
    expect(seed).toMatchObject({ startPoint: { lng: 7.5, lat: 46 }, startPointName: 'Hut', startPointElevation: 2632 })
  })
})
