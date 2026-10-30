import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { SnapNetwork } from '@/features/map/domain/snap-network'
import type { Network } from '@/features/map/domain/track-routing'
import type { ProfiledLine } from '@/features/tours/data/services/swisstopo-profile-service'
import { watchDebounced } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { haversineMeters } from '@/core/utils/haversine'
import { loadNetworkLines, TooFarError } from '@/features/map/data/services/trail-network-service'
import { EMPTY_TRACK, lineLength, pointAlong, trackLine } from '@/features/map/domain/drawn-track'
import { buildNetwork, metersPerUnit, routeToTap, snapTo, toLngLat, toUnits } from '@/features/map/domain/track-routing'
import { getTrackProfile } from '@/features/tours/data/services/swisstopo-profile-service'
import { trackMetrics } from '@/features/tours/domain/route-metrics'

/** How far apart two ways may lie and still meet: tile-cut trails touch, ski routes run side by side. */
const JOIN_M: Record<SnapNetwork, number> = { hiking: 3, ski: 20 }
/** How far a way's loose end reaches across to another: the hiking tiles stop streets short of the trail. */
const BRIDGE_M: Record<SnapNetwork, number> = { hiking: 30, ski: 20 }
/** A leg looks this far around its two points (plus half their distance) for a way between them. */
const MARGIN_M = 400
/** Ways about as near a tap as the nearest one: this share of the snap reach farther still counts. */
const SLACK = 0.4

/**
 * Why the last leg is straight though a network is followed, where the map doesn't show it: no
 * ways to load (offline, never cached). A tap off the ways or a far jump draws straight, as on
 * any map — that needs no word.
 */
export type NetworkIssue = 'unavailable' | null

interface Options {
  seed: DrawnTrack | null
  /** The ways to follow right now; null = straight lines. */
  network: () => SnapNetwork | null
  /** URL template of the current ski-route tiles. */
  skiTemplate: () => Promise<string | null>
}

/**
 * A track being drawn: points set on the map, each joined to the one before along the network
 * (A* over the ways in the tiles around them), with undo/redo and live numbers from the terrain
 * profile. Steps run one after another, so the history only ever holds finished legs; a tap's
 * point shows at once (`queued`) while its leg loads.
 */
export function useTrackDrawing(options: Options) {
  const logger = useLogger('TrackDrawing')
  const track = shallowRef<DrawnTrack>(options.seed ?? EMPTY_TRACK)
  const past = shallowRef<DrawnTrack[]>([])
  const future = shallowRef<DrawnTrack[]>([])
  /** Taps waiting for their leg. */
  const queued = shallowRef<LngLat[]>([])
  const running = ref(0)
  const issue = ref<NetworkIssue>(null)
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

  let built: { key: string, net: Network } | null = null
  async function networkAround(network: SnapNetwork, a: LngLat, b: LngLat) {
    const lat = (a[1] + b[1]) / 2
    const margin = MARGIN_M + haversineMeters(a, b) / 2
    const dLat = margin / 111_320
    const dLng = dLat / Math.cos(lat * Math.PI / 180)
    const bbox: [number, number, number, number] = [
      Math.min(a[0], b[0]) - dLng,
      Math.min(a[1], b[1]) - dLat,
      Math.max(a[0], b[0]) + dLng,
      Math.max(a[1], b[1]) + dLat,
    ]
    const mpu = metersPerUnit(lat)
    try {
      const { key, lines } = await loadNetworkLines(network, bbox, network === 'ski' ? await options.skiTemplate() : null)
      if (built?.key !== key)
        built = { key, net: buildNetwork(lines, JOIN_M[network] / mpu, BRIDGE_M[network] / mpu) }
      issue.value = null
      return { net: built.net, mpu }
    }
    catch (err) {
      issue.value = err instanceof TooFarError ? null : 'unavailable'
      return null
    }
  }

  /** Where a point lands (on the nearest way within `radiusM`) and the leg to it from `from`. */
  async function resolve(from: LngLat | null, to: LngLat, radiusM: number): Promise<{ to: LngLat, line: LngLat[] | null }> {
    const straight = { to, line: from && [from, to] }
    const network = options.network()
    if (!network) {
      issue.value = null
      return straight
    }
    const found = await networkAround(network, from ?? to, to)
    if (!found)
      return straight
    const { net, mpu } = found
    const radius = radiusM / mpu
    const nearest = snapTo(net, toUnits(to), radius)
    const start = from && snapTo(net, toUnits(from), radius)
    const route = start && routeToTap(net, start, toUnits(to), radius, radius * SLACK)
    if (!route) {
      const landed = nearest ? toLngLat(nearest.point) : to
      return { to: landed, line: from && [from, landed] }
    }
    // The leg starts on its point exactly, even one set off the ways.
    const line = route.points.map(toLngLat)
    const landed = line.at(-1)!
    if (haversineMeters(from!, line[0]!) > 1)
      line.unshift(from!)
    else
      line[0] = from!
    return { to: landed, line }
  }

  function add(point: LngLat, radiusM: number) {
    queued.value = [...queued.value, point]
    enqueue(async () => {
      const { points, legs } = track.value
      const { to, line } = await resolve(points.at(-1) ?? null, point, radiusM)
      queued.value = queued.value.filter(q => q !== point)
      commit({ points: [...points, to], legs: line ? [...legs, line] : legs })
    })
  }

  function drag(index: number, point: LngLat | null, insert = false) {
    dragging.value = point && { index, point, insert }
  }

  /** Let go of a dragged point: it lands on the ways, and both its legs follow them again. */
  function drop(index: number, point: LngLat, radiusM: number) {
    enqueue(async () => {
      const { points, legs } = track.value
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
      })
    })
  }

  /** Let go of a point pulled out of leg `leg`: it becomes a point between the leg's two, both new legs following the ways. */
  function dropInsert(leg: number, point: LngLat, radiusM: number) {
    enqueue(async () => {
      const { points, legs } = track.value
      const [a, b] = [points[leg]!, points[leg + 1]!]
      const first = await resolve(a, point, radiusM)
      const second = await resolve(first.to, b, radiusM)
      dragging.value = null
      commit({
        points: [...points.slice(0, leg + 1), first.to, ...points.slice(leg + 1)],
        // The far end stays where it was set.
        legs: [...legs.slice(0, leg), first.line!, [...second.line!.slice(0, -1), b], ...legs.slice(leg + 1)],
      })
    })
  }

  /** The same way back to the start, exactly: an out-and-back in one step. */
  function returnToStart() {
    const { points, legs } = track.value
    if (busy.value || legs.length === 0)
      return
    commit({
      points: [...points, ...points.slice(0, -1).reverse()],
      legs: [...legs, ...[...legs].reverse().map(leg => [...leg].reverse())],
    })
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
    const { points, legs } = track.value
    if (!d)
      return track.value
    if (d.insert) {
      return {
        points: [...points.slice(0, d.index + 1), d.point, ...points.slice(d.index + 1)],
        legs: [...legs.slice(0, d.index), [points[d.index]!, d.point], [d.point, points[d.index + 1]!], ...legs.slice(d.index + 1)],
      }
    }
    return {
      points: points.map((p, i) => (i === d.index ? d.point : p)),
      legs: legs.map((leg, i) => (i === d.index - 1 ? [points[i]!, d.point] : i === d.index ? [d.point, points[i + 1]!] : leg)),
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
  const metrics = computed(() => {
    const distance = Math.round(lineLength(line.value))
    const p = currentProfile.value
    if (!p)
      return { distance, ascent: null, descent: null }
    const coordinates = p.line.map(([lng, lat], i) => (p.heights[i] == null ? [lng, lat] : [lng, lat, p.heights[i]!]))
    const { ascent, descent } = trackMetrics({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }] })
    return { distance, ascent, descent }
  })

  /** Where each leg's middle handle sits: halfway along it. None while a point is held. */
  const handles = computed(() => (dragging.value ? [] : shown.value.legs.map(leg => pointAlong(leg, 0.5))))
  /** The line already ends where it started. */
  const closed = computed(() => {
    const { points } = track.value
    return points.length > 1 && haversineMeters(points[0]!, points.at(-1)!) < 1
  })

  return { track, shown, queued, handles, closed, busy, issue, add, drag, drop, dropInsert, returnToStart, undo, redo, canUndo, canRedo, profile: currentProfile, metrics }
}
