import type { LngLat } from '@/features/map/domain/entities/trail'
import { describe, expect, it } from 'vitest'
import { trackFromLine, trackLine } from '@/features/map/domain/drawn-track'

describe('drawnTrack', () => {
  it('should be a lone point before the first leg, and join legs without doubling their shared point', () => {
    expect(trackLine({ points: [[8, 46]], legs: [] })).toEqual([[8, 46]])
    expect(trackLine({ points: [[8, 46], [8.1, 46], [8.2, 46]], legs: [[[8, 46], [8.1, 46]], [[8.1, 46], [8.2, 46]]] }))
      .toEqual([[8, 46], [8.1, 46], [8.2, 46]])
  })

  it('should keep a long wiggly line exactly while capping the points to drag', () => {
    const line: LngLat[] = Array.from({ length: 400 }, (_, i) => [8 + i * 0.001, 46 + Math.sin(i / 3) * 0.002])
    const track = trackFromLine(line, 10)
    expect(track.points.length).toBeLessThanOrEqual(10)
    expect(track.points[0]).toEqual(line[0])
    expect(track.points.at(-1)).toEqual(line.at(-1))
    expect(trackLine(track)).toEqual(line)
  })

  it('should take a one-point line as a lone point without legs', () => {
    expect(trackFromLine([[8, 46]])).toEqual({ points: [[8, 46]], legs: [] })
  })
})
