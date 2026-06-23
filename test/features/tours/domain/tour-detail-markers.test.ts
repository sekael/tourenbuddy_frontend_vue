import { describe, expect, it } from 'vitest'
import { tourDetailMarkers } from '@/features/tours/domain/tour-detail-markers'

const START = { lng: 7.0, lat: 46.0 }
// ~well over 10m from START, so treated as a distinct end point
const FAR_END = { lng: 7.5, lat: 46.5 }
// a second distinct point, used as a re-picked (draft) location
const ELSEWHERE = { lng: 8.0, lat: 47.0 }
// within the 10m isSameGoal threshold of START → counts as "same" (round trip)
const NEAR_START = { lng: 7.00001, lat: 46.0 }

function input(over: Partial<Parameters<typeof tourDetailMarkers>[0]> = {}) {
  return {
    tourType: 'hiking' as const,
    start: { saved: null, draft: null },
    end: { saved: null, draft: null },
    ...over,
  }
}

describe('tourDetailMarkers', () => {
  it('round trip (end equals start) yields a start marker and no end marker', () => {
    const out = tourDetailMarkers(
      input({ start: { saved: START, draft: null }, end: { saved: NEAR_START, draft: null } }),
    )
    expect(out.map(m => m.pointKind)).toEqual(['start'])
  })

  it('one-way to goal (no end point) yields a start marker and no end marker', () => {
    const out = tourDetailMarkers(input({ start: { saved: START, draft: null } }))
    expect(out.map(m => m.pointKind)).toEqual(['start'])
  })

  it('distinct saved end yields both markers, both saved tone', () => {
    const out = tourDetailMarkers(
      input({ start: { saved: START, draft: null }, end: { saved: FAR_END, draft: null } }),
    )
    expect(out.map(m => m.pointKind).sort()).toEqual(['end', 'start'])
    expect(out.every(m => m.draft === false)).toBe(true)
  })

  it('no start coordinate yields no markers (and no orphan end)', () => {
    const out = tourDetailMarkers(input({ end: { saved: FAR_END, draft: null } }))
    expect(out).toEqual([])
  })

  it('editing the start keeps the saved start AND end, plus a draft start', () => {
    const out = tourDetailMarkers(
      input({
        start: { saved: START, draft: ELSEWHERE },
        end: { saved: FAR_END, draft: null },
      }),
    )
    const starts = out.filter(m => m.pointKind === 'start')
    const ends = out.filter(m => m.pointKind === 'end')
    // saved start (full color, old position) survives the edit
    expect(starts.some(m => !m.draft && m.lngLat === START)).toBe(true)
    // draft start (lighter, new position) shows alongside it
    expect(starts.some(m => m.draft && m.lngLat === ELSEWHERE)).toBe(true)
    // the untouched end stays as a saved marker
    expect(ends).toHaveLength(1)
    expect(ends[0]!.draft).toBe(false)
  })

  it('editing the end keeps the saved end and adds a draft end', () => {
    const out = tourDetailMarkers(
      input({
        start: { saved: START, draft: null },
        end: { saved: FAR_END, draft: ELSEWHERE },
      }),
    )
    const ends = out.filter(m => m.pointKind === 'end')
    expect(ends.some(m => !m.draft && m.lngLat === FAR_END)).toBe(true)
    expect(ends.some(m => m.draft && m.lngLat === ELSEWHERE)).toBe(true)
  })

  it('creation (draft only) renders draft markers and dedups a draft round trip', () => {
    const both = tourDetailMarkers(
      input({ start: { saved: null, draft: START }, end: { saved: null, draft: FAR_END } }),
    )
    expect(both.map(m => m.pointKind).sort()).toEqual(['end', 'start'])
    expect(both.every(m => m.draft === true)).toBe(true)

    const roundTrip = tourDetailMarkers(
      input({ start: { saved: null, draft: START }, end: { saved: null, draft: NEAR_START } }),
    )
    expect(roundTrip.map(m => m.pointKind)).toEqual(['start'])
  })
})
