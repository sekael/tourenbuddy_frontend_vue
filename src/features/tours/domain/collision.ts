import type { Tour } from '@/features/tours/domain/entities/tour'
import { isSameGoal } from '@/features/tours/domain/distance'

/** Two goals within this distance are treated as the same objective. */
export const COLLISION_RADIUS_M = 100

/**
 * The first partner-friend tour whose goal collides (within 100m) with `goal`.
 * Only partner tours qualify — collision on a non-partner friend tour does not
 * prompt (the user has no relationship to that specific tour). Returns null when
 * there is no such collision.
 */
export function findCollidingPartnerTour(
  goal: { lng: number, lat: number },
  friendTours: Tour[],
): Tour | null {
  return (
    friendTours.find(t => t.isPartner === true && isSameGoal(goal, t.goal, COLLISION_RADIUS_M))
    ?? null
  )
}

/**
 * Ids of friend tours that collide (within 100m) with any owned tour. The map
 * suppresses these markers — owned tours take precedence — while the Friends list
 * keeps showing them untouched.
 */
export function friendTourIdsShadowedByOwned(ownedTours: Tour[], friendTours: Tour[]): Set<string> {
  const shadowed = new Set<string>()
  for (const friend of friendTours) {
    if (ownedTours.some(owned => isSameGoal(owned.goal, friend.goal, COLLISION_RADIUS_M)))
      shadowed.add(friend.id)
  }
  return shadowed
}
