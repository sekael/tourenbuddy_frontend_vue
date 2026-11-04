import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { SnapNetwork } from '@/features/map/domain/snap-network'
import type { ProfiledLine } from '@/features/tours/data/services/swisstopo-profile-service'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { watchDebounced } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { haversineMeters } from '@/core/utils/haversine'
import { EMPTY_TRACK, lineLength, pointAlong, trackLine, withWayBack } from '@/features/map/domain/drawn-track'
import { getTrackProfile } from '@/features/tours/data/services/swisstopo-profile-service'
import { trackMetrics } from '@/features/tours/domain/route-metrics'
import { legEnd, useLegRouter } from './use-leg-router'

export type { NetworkIssue } from './use-leg-router'

/** A line's climb, descent and length, the heights from its terrain profile (none: unknown yet). */
export function profileMetrics(line: readonly LngLat[], profile: ProfiledLine | null): RouteMetrics {
  const distance = Math.round(lineLength(line))
  if (!profile)
    return { distance, ascent: null, descent: null }
  const coordinates = profile.line.map(([lng, lat], i) => (profile.heights[i] == null ? [lng, lat] : [lng, lat, profile.heights[i]!]))
  const { ascent, descent } = trackMetrics({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }] })
  return { distance, ascent, descent }
}

interface Options {
  /** The track to go on from; points without legs are stops to join along the ways first (a route's start, goal and end). */
  seed: DrawnTrack | null
  /** What the line follows first, then the base map's ways; null = those ways alone. */
  network: () => SnapNetwork | null
  /** URL template of the current ski-route tiles. */
  skiTemplate: () => Promise<string | null>
}

/**
 * A track being drawn: points set on the map, each joined to the one before along the network
 * (A* over the ways in the tiles around them), with undo/redo and live numbers from the terrain
 * profile. Steps run one after another, so the history only ever holds finished legs; a tap's
 * point shows at once (`queued`) while its leg loads. A route's goal (`DrawnTrack.goal`) stays
 * the same point through every step.
 */
export function useTrackDrawing(options: Options) {
  const logger = useLogger('TrackDrawing')
  const track = shallowRef<DrawnTrack>(options.seed ?? EMPTY_TRACK)
  const past = shallowRef<DrawnTrack[]>([])
  const future = shallowRef<DrawnTrack[]>([])
  /** Taps waiting for their leg. */
  const queued = shallowRef<LngLat[]>([])
  const running = ref(0)
  /**
   * A point under the finger, shown with straight legs until it is let go: an existing point
   * (`index`), or a new one pulled out of leg `index` by its middle handle (`insert`).
   */
  const dragging = shallowRef<{ index: number, point: LngLat, insert: boolean } | null>(null)

  const busy = computed(() => running.value > 0)

  let chain = Promise.resolve()
  function enqueue(step: () => Promise<void>) {
    running.value++
    chain = chain.then(step).catch(err => logger.warn('Drawing step failed', err)).finally(() => running.value--)
  }

  function commit(next: DrawnTrack) {
    past.value = [...past.value, track.value]
    future.value = []
    track.value = next
  }

  const { issue, resolve, between } = useLegRouter(options)

  // A route's stops, joined along the ways as the drawing opens: where it starts, not a step to undo.
  const stops = options.seed && options.seed.legs.length === 0 && options.seed.points.length > 1 ? options.seed : null
  if (stops) {
    const { points, goal } = stops
    track.value = { points, legs: points.slice(1).map((p, i) => [points[i]!, p]), goal }
    enqueue(async () => {
      const legs: LngLat[][] = []
      for (let i = 1; i < points.length; i++)
        legs.push(await between(points[i - 1]!, points[i]!, [legEnd(i - 1, points.length, goal), legEnd(i, points.length, goal)]))
      track.value = { points, legs, goal }
    })
  }

  function add(point: LngLat, radiusM: number) {
    queued.value = [...queued.value, point]
    enqueue(async () => {
      const { points, legs } = track.value
      const { to, line } = await resolve(points.at(-1) ?? null, point, radiusM)
      queued.value = queued.value.filter(q => q !== point)
      commit({ points: [...points, to], legs: line ? [...legs, line] : legs, goal: track.value.goal })
    })
  }

  function drag(index: number, point: LngLat | null, insert = false) {
    dragging.value = point && { index, point, insert }
  }

  /** Let go of a dragged point: it lands on the ways, and both its legs follow them again. */
  function drop(index: number, point: LngLat, radiusM: number) {
    enqueue(async () => {
      const { points, legs, goal } = track.value
      const before = await resolve(points[index - 1] ?? null, point, radiusM)
      const next = points[index + 1]
      const after = next && await resolve(before.to, next, radiusM)
      dragging.value = null
      commit({
        points: points.map((p, i) => (i === index ? before.to : p)),
        legs: legs.map((leg, i) => {
          if (i === index - 1)
            return before.line!
          // Its far end stays where it was set.
          return i === index && after?.line ? [...after.line.slice(0, -1), next!] : leg
        }),
        goal,
      })
    })
  }

  /** Let go of a point pulled out of leg `leg`: it becomes a point between the leg's two, both new legs following the ways. */
  function dropInsert(leg: number, point: LngLat, radiusM: number) {
    enqueue(async () => {
      const { points, legs, goal } = track.value
      const [a, b] = [points[leg]!, points[leg + 1]!]
      const first = await resolve(a, point, radiusM)
      const second = await resolve(first.to, b, radiusM)
      dragging.value = null
      commit({
        points: [...points.slice(0, leg + 1), first.to, ...points.slice(leg + 1)],
        // The far end stays where it was set.
        legs: [...legs.slice(0, leg), first.line!, [...second.line!.slice(0, -1), b], ...legs.slice(leg + 1)],
        goal: goal != null && goal > leg ? goal + 1 : goal,
      })
    })
  }

  /** The same way back to the start, exactly: an out-and-back in one step. */
  function returnToStart() {
    if (busy.value || track.value.legs.length === 0)
      return
    commit(withWayBack(track.value))
  }

  const canUndo = computed(() => !busy.value && past.value.length > 0)
  const canRedo = computed(() => !busy.value && future.value.length > 0)

  function undo() {
    if (!canUndo.value)
      return
    future.value = [track.value, ...future.value]
    track.value = past.value.at(-1)!
    past.value = past.value.slice(0, -1)
  }

  function redo() {
    if (!canRedo.value)
      return
    past.value = [...past.value, track.value]
    track.value = future.value[0]!
    future.value = future.value.slice(1)
  }

  /** What the map shows: the track, with a dragged point on straight legs. */
  const shown = computed<DrawnTrack>(() => {
    const d = dragging.value
    const { points, legs, goal } = track.value
    if (!d)
      return track.value
    if (d.insert) {
      return {
        points: [...points.slice(0, d.index + 1), d.point, ...points.slice(d.index + 1)],
        legs: [...legs.slice(0, d.index), [points[d.index]!, d.point], [d.point, points[d.index + 1]!], ...legs.slice(d.index + 1)],
        goal: goal != null && goal > d.index ? goal + 1 : goal,
      }
    }
    return {
      points: points.map((p, i) => (i === d.index ? d.point : p)),
      legs: legs.map((leg, i) => (i === d.index - 1 ? [points[i]!, d.point] : i === d.index ? [d.point, points[i + 1]!] : leg)),
      goal,
    }
  })

  // ── Live numbers ──────────────────────────────────────────────────────────
  const line = computed(() => trackLine(track.value))
  const profile = shallowRef<{ for: DrawnTrack, result: ProfiledLine } | null>(null)
  watchDebounced(track, async (current) => {
    const result = await getTrackProfile(trackLine(current))
    if (result && track.value === current)
      profile.value = { for: current, result }
  }, { debounce: 300, immediate: true })

  /** The profile of the track as it is now; null while it loads, or offline. */
  const currentProfile = computed(() => (profile.value?.for === track.value ? profile.value.result : null))
  const metrics = computed(() => profileMetrics(line.value, currentProfile.value))

  /** Where each leg's middle handle sits: halfway along it. None while a point is held. */
  const handles = computed(() => (dragging.value ? [] : shown.value.legs.map(leg => pointAlong(leg, 0.5))))
  /** The line already ends where it started. */
  const closed = computed(() => {
    const { points } = track.value
    return points.length > 1 && haversineMeters(points[0]!, points.at(-1)!) < 1
  })

  return { track, shown, queued, handles, closed, busy, issue, add, drag, drop, dropInsert, returnToStart, undo, redo, canUndo, canRedo, profile: currentProfile, metrics }
}
