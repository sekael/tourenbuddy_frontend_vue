import type { TourType } from '@/features/tours/data/models/tour-type'

/**
 * A tour's activities per leg (change: activity-legs): the way up runs start → goal, the way
 * down goal → end. `null` = every activity both ways. Both in `TOUR_TYPE_VALUES` order, their
 * union is the tour's `tourTypes` (DB CHECK `tours_legs_check`).
 */
export interface TourLegs {
  ascent: TourType[]
  descent: TourType[]
}

export type LegDirection = 'up' | 'both' | 'down'

/** An untouched activity's way (design D3): paragliding with others flies down, the rest go up. */
export function defaultDirection(type: TourType, types: readonly TourType[]): LegDirection {
  if (types.length < 2 || !types.includes('paragliding'))
    return 'both'
  return type === 'paragliding' ? 'down' : 'up'
}

/** The legs a way per activity gives; null when nothing differs or a leg would be empty. */
export function legsFrom(types: readonly TourType[], direction: (type: TourType) => LegDirection): TourLegs | null {
  const ascent = types.filter(t => direction(t) !== 'down')
  const descent = types.filter(t => direction(t) !== 'up')
  const split = ascent.length < types.length || descent.length < types.length
  return split && ascent.length > 0 && descent.length > 0 ? { ascent, descent } : null
}

/** An activity's way in stored legs; `both` for an unsplit tour or an activity the legs don't name. */
export function directionOf(legs: TourLegs | null, type: TourType): LegDirection {
  const up = legs?.ascent.includes(type) ?? true
  const down = legs?.descent.includes(type) ?? true
  return up === down ? 'both' : up ? 'up' : 'down'
}

/** The legs still add up to these activities — the server's rule for keeping them (D2). */
export function legsMatch(types: readonly TourType[], legs: TourLegs): boolean {
  const union = new Set([...legs.ascent, ...legs.descent])
  return union.size === types.length && types.every(t => union.has(t))
}

/** The activities the way the route runs — the way up first. */
export function routeOrder(tour: { tourTypes: readonly TourType[], legs?: TourLegs | null }): TourType[] {
  const { legs } = tour
  return legs ? [...legs.ascent, ...legs.descent.filter(t => !legs.ascent.includes(t))] : [...tour.tourTypes]
}

/** The way down ends in a flight — ski or walk to a lower launch first or not — so the end is a landing. */
export function landsByAir(tour: { tourTypes: readonly TourType[], legs?: TourLegs | null }): boolean {
  return (tour.legs?.descent ?? tour.tourTypes).includes('paragliding')
}

/** The whole way down is flown: its descent is the flight's drop. */
export function fliesDown(tour: { tourTypes: readonly TourType[], legs?: TourLegs | null }): boolean {
  const down = tour.legs?.descent ?? tour.tourTypes
  return down.length === 1 && down[0] === 'paragliding'
}
