import type { LngLat } from '@/features/map/domain/entities/trail'
import { haversineMeters } from '@/core/utils/haversine'

/** A track drawn on the map: the points the user set and the way between each two. */
export interface DrawnTrack {
  points: LngLat[]
  /** `legs[i]` runs from `points[i]` to `points[i + 1]`, both ends included. */
  legs: LngLat[][]
}

export const EMPTY_TRACK: DrawnTrack = { points: [], legs: [] }

/** The whole line, leg after leg; a lone point is a line of one. */
export function trackLine({ points, legs }: DrawnTrack): LngLat[] {
  if (legs.length === 0)
    return points.slice(0, 1)
  return legs.flatMap((leg, i) => (i === 0 ? leg : leg.slice(1)))
}

/** Metres along the line. */
export function lineLength(line: readonly LngLat[]): number {
  return line.reduce((sum, p, i) => (i > 0 ? sum + haversineMeters(line[i - 1]!, p) : sum), 0)
}

/** Distance in metres from `p` to the segment `a`–`b`, on a local flat projection. */
function offset(p: LngLat, a: LngLat, b: LngLat): number {
  const k = Math.cos(p[1] * Math.PI / 180)
  const [ax, ay, bx, by, px, py] = [a[0] * k, a[1], b[0] * k, b[1], p[0] * k, p[1]]
  const dx = bx - ax
  const dy = by - ay
  const dd = dx * dx + dy * dy
  const t = dd === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / dd))
  return haversineMeters(p, [(ax + t * dx) / k, ay + t * dy])
}

/** Indices Douglas–Peucker keeps at `tolerance` metres. */
function keep(line: readonly LngLat[], tolerance: number): number[] {
  const kept = new Set([0, line.length - 1])
  const stack: [number, number][] = [[0, line.length - 1]]
  while (stack.length > 0) {
    const [from, to] = stack.pop()!
    let far = -1
    let farthest = tolerance
    for (let i = from + 1; i < to; i++) {
      const d = offset(line[i]!, line[from]!, line[to]!)
      if (d > farthest) {
        farthest = d
        far = i
      }
    }
    if (far >= 0) {
      kept.add(far)
      stack.push([from, far], [far, to])
    }
  }
  return [...kept].sort((a, b) => a - b)
}

/**
 * An existing line (an uploaded or saved track) as a drawing to edit: its turning points become
 * the points to drag, at most `maxPoints`; the legs keep the line exactly as it was.
 */
export function trackFromLine(line: readonly LngLat[], maxPoints = 10): DrawnTrack {
  if (line.length < 2)
    return { points: [...line], legs: [] }
  let tolerance = 40
  let indices = keep(line, tolerance)
  while (indices.length > maxPoints) {
    tolerance *= 2
    indices = keep(line, tolerance)
  }
  return {
    points: indices.map(i => line[i]!),
    legs: indices.slice(1).map((end, k) => line.slice(indices[k]!, end + 1)),
  }
}
