import type { TrailOverlayId } from '@/features/map/data/trail-overlays'

/** The ways a drawn line follows; null = straight lines between the points. */
export type SnapNetwork = TrailOverlayId

const SKI_TOURING = new Set(['skitour', 'splitboarding', 'ski-mountaineering'])
const ON_TRAILS = new Set(['hiking', 'trailrunning'])

/**
 * A drawing follows what the map shows: the hiking trails, the ski routes, or — both shown — the
 * ones the tour's activity goes on. Ski touring picks the ski routes; hiking wins when both are
 * picked, and when the activity says neither.
 */
export function snapNetworkFor(overlays: readonly TrailOverlayId[], tourTypes: readonly string[]): SnapNetwork | null {
  const hiking = overlays.includes('hiking')
  const ski = overlays.includes('ski')
  if (hiking && ski)
    return tourTypes.some(t => SKI_TOURING.has(t)) && !tourTypes.some(t => ON_TRAILS.has(t)) ? 'ski' : 'hiking'
  return hiking ? 'hiking' : ski ? 'ski' : null
}
