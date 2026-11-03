import type { Map as MapLibreMap, VectorTileSource } from 'maplibre-gl'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { SnapNetwork } from '@/features/map/domain/snap-network'
import type { Network } from '@/features/map/domain/track-routing'
import { ref } from 'vue'
import { z } from 'zod'
import { haversineMeters } from '@/core/utils/haversine'
import { loadNetworkLines, TooFarError } from '@/features/map/data/services/trail-network-service'
import { SKI_ROUTES_TILEJSON } from '@/features/map/data/trail-overlays'
import { lineLength } from '@/features/map/domain/drawn-track'
import { buildNetwork, metersPerUnit, routeToTap, snapTo, toLngLat, toUnits } from '@/features/map/domain/track-routing'
import { SKI_ROUTES_SOURCE_ID } from '@/features/map/presentation/components/trail-layers'

/** How far apart two ways may lie and still meet: tile-cut trails touch (ski routes reach farther, their own). */
const JOIN_M = 3
/** How far a way's loose end reaches across to another: the base tiles stop streets short of the trail. */
const BRIDGE_M = 30
/** A leg looks this far around its two points (plus half their distance) for a way between them. */
const MARGIN_M = 400
/** Ways about as near a tap as the nearest one: this share of the snap reach farther still counts. */
const SLACK = 0.4
/**
 * A way this many times the straight distance, and this much longer, goes too far round (a dead
 * end, the next junction kilometres off): the leg goes straight, as off the ways. The floor keeps
 * a few switchbacks on their path.
 */
const DETOUR = 2.5
const DETOUR_MIN_M = 500
/** A route's stop (a hut, a summit, a bus stop) joins a way this far off… */
export const STOP_SNAP_M = 250
/** …and, no way that near (a summit above the trail's end), one this far: the last bit goes straight. */
const FAR_STOP_M = 1000

/**
 * Why the last leg is straight though a network is followed, where the map doesn't show it: no
 * ways to load (offline, never cached). A tap off the ways or a far jump draws straight: `isGap`.
 */
export type NetworkIssue = 'unavailable' | null

/** A straight leg shorter than this is just the last bit to a point, not a gap in the ways. */
const GAP_M = 50
/** A leg that found no way: straight, and longer than the last bit to a point — the line says so. */
export const isGap = (leg: readonly LngLat[]) => leg.length === 2 && haversineMeters(leg[0]!, leg[1]!) > GAP_M

interface Options {
  /** What the line follows first, then the base map's ways; null = those ways alone. */
  network: () => SnapNetwork | null
  /** URL template of the current ski-route tiles. */
  skiTemplate: () => Promise<string | null>
  /** Tiles a leg may span before it goes straight (the route step's legs run farther than taps). */
  maxTiles?: number
}

/**
 * Legs along the ways (track-drawing, map-first-tour-creation D8): A* over the ways in the tiles
 * around a leg's two points, the way the drawing joins its taps and the route step its points.
 */
export function useLegRouter({ network, skiTemplate, maxTiles }: Options) {
  const issue = ref<NetworkIssue>(null)
  let built: { key: string, net: Network } | null = null

  async function networkAround(net: SnapNetwork | null, a: LngLat, b: LngLat) {
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
      const { key, lines } = await loadNetworkLines(net, bbox, net === 'ski' ? await skiTemplate() : null, maxTiles)
      if (built?.key !== key)
        built = { key, net: buildNetwork(lines, JOIN_M / mpu, BRIDGE_M / mpu) }
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
    const found = await networkAround(network(), from ?? to, to)
    if (!found)
      return straight
    const { net, mpu } = found
    const radius = radiusM / mpu
    const nearest = snapTo(net, toUnits(to), radius)
    const start = from && snapTo(net, toUnits(from), radius)
    const line = start && routeToTap(net, start, toUnits(to), radius, radius * SLACK)?.points.map(toLngLat)
    const direct = from ? haversineMeters(from, to) : 0
    if (!line || lineLength(line) > Math.max(DETOUR * direct, direct + DETOUR_MIN_M)) {
      const landed = nearest ? toLngLat(nearest.point) : to
      return { to: landed, line: from && [from, landed] }
    }
    // The leg starts on its point exactly, even one set off the ways.
    const landed = line.at(-1)!
    if (haversineMeters(from!, line[0]!) > 1)
      line.unshift(from!)
    else
      line[0] = from!
    return { to: landed, line }
  }

  /**
   * The leg between two set points, both kept exactly where they are (a hut, a summit): along the
   * ways between them, joined to each by its last straight bit; straight where no way leads. A point
   * off the ways reaches farther for one before its leg gives up.
   */
  async function between(from: LngLat, to: LngLat, radiusM: number): Promise<LngLat[]> {
    let { line } = await resolve(from, to, radiusM)
    if ((!line || line.length < 3) && radiusM < FAR_STOP_M)
      line = (await resolve(from, to, FAR_STOP_M)).line
    const leg = line ?? [from, to]
    if (haversineMeters(leg.at(-1)!, to) > 1)
      leg.push(to)
    else
      leg[leg.length - 1] = to
    return leg
  }

  return { issue, resolve, between }
}

const skiManifest = z.object({ tiles: z.array(z.string()).min(1) })

/** The ski-route tiles' URL template: the map's own source, else the dataset's manifest. */
export async function skiTilesTemplate(map: MapLibreMap | null): Promise<string | null> {
  const fromMap = map?.getSource<VectorTileSource>(SKI_ROUTES_SOURCE_ID)?.tiles?.[0]
  if (fromMap)
    return fromMap
  try {
    return skiManifest.parse(await (await fetch(SKI_ROUTES_TILEJSON)).json()).tiles[0]!
  }
  catch {
    return null
  }
}
