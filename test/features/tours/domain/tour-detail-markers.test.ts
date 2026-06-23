import { describe, expect, it } from 'vitest'
import { tourDetailMarkers } from '@/features/tours/domain/tour-detail-markers'

const START = { lng: 7.0, lat: 46.0 }
// ~well over 10m from START, so treated as a distinct end point
const FAR_END = { lng: 7.5, lat: 46.5 }
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

  it('distinct end yields both markers', () => {
    const out = tourDetailMarkers(
      input({ start: { saved: START, draft: null }, end: { saved: FAR_END, draft: null } }),
    )
    expect(out.map(m => m.pointKind).sort()).toEqual(['end', 'start'])
  })

  it('no start coordinate yields no markers (and no orphan end)', () => {
    const out = tourDetailMarkers(input({ end: { saved: FAR_END, draft: null } }))
    expect(out).toEqual([])
  })

  it('a draft override on one point marks only that point as draft', () => {
    const out = tourDetailMarkers(
      input({
        start: { saved: START, draft: null },
        end: { saved: FAR_END, draft: { lng: 8.0, lat: 47.0 } },
      }),
    )
    const start = out.find(m => m.pointKind === 'start')!
    const end = out.find(m => m.pointKind === 'end')!
    expect(start.draft).toBe(false)
    expect(end.draft).toBe(true)
    expect(end.lngLat).toEqual({ lng: 8.0, lat: 47.0 })
  })

  it('uses the draft start over the saved one for the distinctness check', () => {
    // Saved start == saved end (would be a round trip), but the user re-picked the
    // start far away → the end is now distinct and both markers should show.
    const out = tourDetailMarkers(
      input({
        start: { saved: NEAR_START, draft: FAR_END },
        end: { saved: START, draft: null },
      }),
    )
    expect(out.map(m => m.pointKind).sort()).toEqual(['end', 'start'])
  })
})
