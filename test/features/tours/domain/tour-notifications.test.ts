import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { describe, expect, it } from 'vitest'
import { isMeaningfulTourChange, isShareableTour } from '@/features/tours/domain/tour-notifications'

const GOAL = { lng: 9.86, lat: 46.73 }

function tour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 't1',
    userId: 'u1',
    plannedDate: new Date('2027-01-09'),
    endDate: null,
    goal: GOAL,
    name: 'Gfroren Hora',
    partnerIds: ['c1'],
    tourType: 'skitour',
    elevation: 2747,
    gpxFilepath: null,
    description: 'desc',
    seasons: ['winter'],
    startPoint: null,
    endPoint: null,
    startPointName: null,
    startPointElevation: null,
    endPointName: null,
    endPointElevation: null,
    equipment: 'skis',
    notes: 'private notes',
    completed: false,
    visibility: 'friends',
    isFriendTour: false,
    ...overrides,
  }
}

function draftFrom(t: Tour, overrides: Partial<TourDraft> = {}): TourDraft {
  return {
    name: t.name,
    plannedDate: t.plannedDate,
    endDate: t.endDate,
    partnerIds: t.partnerIds,
    tourType: t.tourType,
    elevation: t.elevation,
    gpxFilepath: t.gpxFilepath,
    description: t.description,
    seasons: t.seasons,
    startPoint: t.startPoint,
    endPoint: t.endPoint,
    startPointName: t.startPointName,
    startPointElevation: t.startPointElevation,
    endPointName: t.endPointName,
    endPointElevation: t.endPointElevation,
    equipment: t.equipment,
    notes: t.notes,
    visibility: t.visibility,
    ...overrides,
  }
}

describe('isMeaningfulTourChange', () => {
  const prev = tour()
  const next = { goal: GOAL, gpxFilepath: null }

  it('returns false when only non-partner-facing fields change (notes, elevation, seasons)', () => {
    const draft = draftFrom(prev, { notes: 'new notes', elevation: 9999, seasons: ['summer'] })
    expect(isMeaningfulTourChange(prev, draft, next)).toBe(false)
  })

  it('detects a planned-date change', () => {
    const draft = draftFrom(prev, { plannedDate: new Date('2027-02-01') })
    expect(isMeaningfulTourChange(prev, draft, next)).toBe(true)
  })

  it('detects a one-day tour being extended into a span', () => {
    const draft = draftFrom(prev, { endDate: new Date('2027-01-11') })
    expect(isMeaningfulTourChange(prev, draft, next)).toBe(true)
  })

  it('detects a span being shortened back to a single day', () => {
    const spanned = tour({ endDate: new Date('2027-01-11') })
    const draft = draftFrom(spanned, { endDate: null })
    expect(isMeaningfulTourChange(spanned, draft, next)).toBe(true)
  })

  it('is false when an unchanged span is re-submitted', () => {
    const spanned = tour({ endDate: new Date('2027-01-11') })
    const draft = draftFrom(spanned, { endDate: new Date('2027-01-11') })
    expect(isMeaningfulTourChange(spanned, draft, next)).toBe(false)
  })

  it('detects a goal-location change via the next comparison', () => {
    const draft = draftFrom(prev)
    expect(isMeaningfulTourChange(prev, draft, { goal: { lng: 9.9, lat: 46.73 }, gpxFilepath: null })).toBe(true)
  })

  it('detects a GPX track being added', () => {
    const draft = draftFrom(prev)
    expect(isMeaningfulTourChange(prev, draft, { goal: GOAL, gpxFilepath: 'u1/t1.gpx' })).toBe(true)
  })

  it('detects partner set changes regardless of order', () => {
    const multi = tour({ partnerIds: ['a', 'b'] })
    expect(isMeaningfulTourChange(multi, draftFrom(multi, { partnerIds: ['b', 'a'] }), next)).toBe(false)
    expect(isMeaningfulTourChange(multi, draftFrom(multi, { partnerIds: ['a'] }), next)).toBe(true)
  })

  it('detects description and equipment changes (mission-critical detail)', () => {
    expect(isMeaningfulTourChange(prev, draftFrom(prev, { description: 'changed' }), next)).toBe(true)
    expect(isMeaningfulTourChange(prev, draftFrom(prev, { equipment: 'crampons' }), next)).toBe(true)
  })
})

describe('isShareableTour', () => {
  it('is false for a private tour even with partners', () => {
    expect(isShareableTour('private', ['c1'])).toBe(false)
  })

  it('is false for a friends tour with no partners', () => {
    expect(isShareableTour('friends', [])).toBe(false)
  })

  it('defaults undefined visibility to friends and is true with partners', () => {
    expect(isShareableTour(undefined, ['c1'])).toBe(true)
  })
})
