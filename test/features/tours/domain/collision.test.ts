import type { Tour } from '@/features/tours/domain/entities/tour'
import { describe, expect, it } from 'vitest'
import {
  findCollidingPartnerTour,
  friendTourIdsShadowedByOwned,
} from '@/features/tours/domain/collision'

// Sertig (~46.73, 9.86). ~120m north is outside the 100m radius; ~50m is inside.
const GOAL = { lng: 9.86, lat: 46.73 }
const NEAR = { lng: 9.86, lat: 46.7304 } // ~44m north
const FAR = { lng: 9.86, lat: 46.732 } // ~220m north

function friendTour(overrides: Partial<Tour>): Tour {
  return {
    id: 'f1',
    userId: 'owner',
    plannedDate: null,
    goal: GOAL,
    name: 'Shared',
    partnerIds: [],
    tourType: null,
    elevation: null,
    gpxFilepath: null,
    description: null,
    seasons: null,
    startPoint: null,
    endPoint: null,
    startPointName: null,
    startPointElevation: null,
    endPointName: null,
    endPointElevation: null,
    equipment: null,
    notes: null,
    completed: false,
    visibility: 'friends',
    isFriendTour: true,
    isPartner: true,
    partnerNames: [],
    ...overrides,
  }
}

describe('findCollidingPartnerTour', () => {
  it('ignores a colliding friend tour the user is NOT a partner on', () => {
    const tours = [friendTour({ isPartner: false, goal: NEAR })]
    expect(findCollidingPartnerTour(GOAL, tours)).toBeNull()
  })

  it('ignores a partner tour outside the 100m radius', () => {
    const tours = [friendTour({ isPartner: true, goal: FAR })]
    expect(findCollidingPartnerTour(GOAL, tours)).toBeNull()
  })

  it('returns the partner tour within the radius', () => {
    const hit = friendTour({ id: 'hit', isPartner: true, goal: NEAR })
    expect(findCollidingPartnerTour(GOAL, [hit])?.id).toBe('hit')
  })
})

describe('friendTourIdsShadowedByOwned', () => {
  it('shadows a friend tour colliding with an owned tour', () => {
    const owned = [friendTour({ id: 'o1', isFriendTour: false, goal: GOAL })]
    const friends = [friendTour({ id: 'f1', goal: NEAR })]
    expect(friendTourIdsShadowedByOwned(owned, friends).has('f1')).toBe(true)
  })

  it('does not shadow a friend tour far from every owned tour', () => {
    const owned = [friendTour({ id: 'o1', isFriendTour: false, goal: GOAL })]
    const friends = [friendTour({ id: 'f1', goal: FAR })]
    expect(friendTourIdsShadowedByOwned(owned, friends).size).toBe(0)
  })
})
