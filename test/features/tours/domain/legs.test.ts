import { describe, expect, it } from 'vitest'
import { defaultDirection, directionOf, fliesDown, landsByAir, legsFrom, legsMatch, routeOrder } from '@/features/tours/domain/legs'

describe('defaultDirection', () => {
  it('should fly down and walk up once paragliding comes with something else', () => {
    expect(defaultDirection('paragliding', ['paragliding', 'climbing'])).toBe('down')
    expect(defaultDirection('climbing', ['paragliding', 'climbing'])).toBe('up')
  })

  it('should keep paragliding alone, and tours without it, both ways', () => {
    expect(defaultDirection('paragliding', ['paragliding'])).toBe('both')
    expect(defaultDirection('hiking', ['hiking', 'mountain-biking'])).toBe('both')
  })
})

describe('legsFrom', () => {
  it('should not split when every activity goes both ways', () => {
    expect(legsFrom(['hiking', 'mountain-biking'], () => 'both')).toBeNull()
  })

  it('should not split when one leg would be empty', () => {
    expect(legsFrom(['paragliding', 'hiking'], () => 'down')).toBeNull()
  })

  it('should let an activity run on both legs of a split tour', () => {
    const way = { skitour: 'both', paragliding: 'down' } as const
    expect(legsFrom(['skitour', 'paragliding'], t => way[t as keyof typeof way])).toEqual({ ascent: ['skitour'], descent: ['skitour', 'paragliding'] })
  })
})

describe('directionOf', () => {
  it('should call an activity the legs do not name both ways', () => {
    expect(directionOf({ ascent: ['hiking'], descent: ['paragliding'] }, 'mountain-biking')).toBe('both')
  })
})

describe('legsMatch', () => {
  it('should fail once an activity joins or leaves', () => {
    const legs = { ascent: ['hiking'], descent: ['paragliding'] } as const
    expect(legsMatch(['paragliding', 'hiking'], { ascent: [...legs.ascent], descent: [...legs.descent] })).toBe(true)
    expect(legsMatch(['hiking'], { ascent: [...legs.ascent], descent: [...legs.descent] })).toBe(false)
  })
})

describe('routeOrder / landsByAir', () => {
  it('should lead with the way up although paragliding sorts first', () => {
    expect(routeOrder({ tourTypes: ['paragliding', 'hiking'], legs: { ascent: ['hiking'], descent: ['paragliding'] } })).toEqual(['hiking', 'paragliding'])
  })

  it('should land whenever the way down ends in a flight, but count only a pure flight as flown', () => {
    const skiAndFly = { tourTypes: ['paragliding', 'skitour'], legs: { ascent: ['skitour'], descent: ['skitour', 'paragliding'] } } as const
    const tour = { tourTypes: [...skiAndFly.tourTypes], legs: { ascent: [...skiAndFly.legs.ascent], descent: [...skiAndFly.legs.descent] } }
    expect([landsByAir(tour), fliesDown(tour)]).toEqual([true, false])
    expect([landsByAir({ tourTypes: ['paragliding'] }), fliesDown({ tourTypes: ['paragliding'] })]).toEqual([true, true])
    expect(landsByAir({ tourTypes: ['hiking'] })).toBe(false)
  })
})
