import type { Tour } from '@/features/tours/domain/entities/tour'
import { isSameGoal } from '@/features/tours/domain/distance'

/** Two goals within this distance are treated as the same objective. */
export const COLLISION_RADIUS_M = 100

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

/**
 * Inverse of {@link friendTourIdsShadowedByOwned}: ids of owned tours that
 * collide (within 100m) with any of the given friend tours. The map calls this
 * scoped to the *selected* friend tour only — a friend tour opened from the list
 * temporarily overrides owned precedence at its location, so the colliding owned
 * marker is hidden (avoids a co-located cluster) until the friend tour is closed.
 */
export function ownedTourIdsShadowedByFriends(
  ownedTours: Tour[],
  friendTours: Tour[],
): Set<string> {
  const shadowed = new Set<string>()
  for (const owned of ownedTours) {
    if (friendTours.some(friend => isSameGoal(friend.goal, owned.goal, COLLISION_RADIUS_M)))
      shadowed.add(owned.id)
  }
  return shadowed
}
