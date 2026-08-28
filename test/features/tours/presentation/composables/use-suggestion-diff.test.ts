import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import type { SuggestionItem } from '@/features/tours/domain/entities/tour-suggestion'
import { describe, expect, it } from 'vitest'
import { buildSuggestionItems } from '@/features/tours/presentation/composables/use-suggestion-diff'

const GOAL = { lng: 8.2, lat: 46.8 }

const tour: Tour = {
  id: 't1',
  userId: 'owner',
  plannedDate: new Date('2026-02-01'),
  endDate: null,
  goal: GOAL,
  name: 'Gfroren Hora',
  partnerIds: [],
  tourType: 'skitour',
  elevation: 2400,
  gpxFilepath: null,
  description: 'North face',
  seasons: ['winter'],
  startPoint: { lng: 8.1, lat: 46.7 },
  endPoint: null,
  startPointName: 'Talstation',
  startPointElevation: 1200,
  endPointName: null,
  endPointElevation: null,
  equipment: 'Ski, Felle',
  notes: null,
  completed: false,
  visibility: 'friends',
  updatedAt: null,
  isFriendTour: true,
  isPartner: true,
}

const draft: TourDraft = {
  name: tour.name,
  plannedDate: tour.plannedDate,
  endDate: tour.endDate,
  partnerIds: [],
  tourType: tour.tourType,
  elevation: tour.elevation,
  gpxFilepath: tour.gpxFilepath,
  description: tour.description,
  seasons: tour.seasons,
  startPoint: tour.startPoint,
  endPoint: tour.endPoint,
  startPointName: tour.startPointName,
  startPointElevation: tour.startPointElevation,
  endPointName: tour.endPointName,
  endPointElevation: tour.endPointElevation,
  equipment: tour.equipment,
  notes: tour.notes,
  completed: tour.completed,
  visibility: tour.visibility,
}

function fieldsOf(items: SuggestionItem[]): string[] {
  return items.map(i => i.field).sort()
}

function itemFor(items: SuggestionItem[], field: string): SuggestionItem | undefined {
  return items.find(i => i.field === field)
}

describe('buildSuggestionItems', () => {
  it('should emit nothing when the draft matches the tour', () => {
    expect(buildSuggestionItems(tour, draft, GOAL)).toEqual([])
  })

  it('should emit ONE dates item carrying both dates when only the end date changed', () => {
    // Splitting them would let an owner accept a new end_date against an unchanged
    // planned_date and trip tours_end_date_after_start — a constraint error surfaced to
    // someone who did nothing wrong (design D2).
    const items = buildSuggestionItems(
      tour,
      { ...draft, endDate: new Date('2026-02-03') },
      GOAL,
    )
    expect(fieldsOf(items)).toEqual(['dates'])
    expect(itemFor(items, 'dates')!.value).toEqual({
      plannedDate: '2026-02-01',
      endDate: '2026-02-03',
    })
  })

  it('should emit an item with a null value when a field is cleared, not omit it', () => {
    // The absence of a suggestion is the absence of a row; a null value is a real
    // suggestion ("remove the description", D1).
    const items = buildSuggestionItems(tour, { ...draft, description: null }, GOAL)
    expect(fieldsOf(items)).toEqual(['description'])
    expect(itemFor(items, 'description')!.value).toBeNull()
  })

  it('should treat an emptied text input as a clear, not as a distinct value', () => {
    const items = buildSuggestionItems(tour, { ...draft, description: '' }, GOAL)
    expect(itemFor(items, 'description')!.value).toBeNull()
  })

  it('should emit ONE goal item carrying elevation and NO standalone elevation when the goal moved', () => {
    // "Accept the new summit, decline the new altitude" would otherwise be a reachable
    // tap sequence producing wrong data about a mountain (D2).
    const items = buildSuggestionItems(
      tour,
      { ...draft, elevation: 2450 },
      { lng: 8.25, lat: 46.81 },
    )
    expect(fieldsOf(items)).toEqual(['goal'])
    expect(itemFor(items, 'goal')!.value).toEqual({ lng: 8.25, lat: 46.81, elevation: 2450 })
  })

  it('should emit elevation on its own when it was edited without moving the goal', () => {
    const items = buildSuggestionItems(tour, { ...draft, elevation: 2450 }, GOAL)
    expect(fieldsOf(items)).toEqual(['elevation'])
    expect(itemFor(items, 'elevation')!.value).toBe(2450)
  })

  it('should bundle name and elevation into a moved start point', () => {
    const items = buildSuggestionItems(
      tour,
      {
        ...draft,
        startPoint: { lng: 8.15, lat: 46.72 },
        startPointName: 'Parkplatz',
        startPointElevation: 1250,
      },
      GOAL,
    )
    expect(fieldsOf(items)).toEqual(['start_point'])
    expect(itemFor(items, 'start_point')!.value).toEqual({
      lng: 8.15,
      lat: 46.72,
      name: 'Parkplatz',
      elevation: 1250,
    })
  })

  it('should emit a null start_point when the point is cleared', () => {
    const items = buildSuggestionItems(tour, { ...draft, startPoint: null }, GOAL)
    expect(fieldsOf(items)).toEqual(['start_point'])
    expect(itemFor(items, 'start_point')!.value).toBeNull()
  })

  it('should never emit completed, visibility or the partner set', () => {
    // Absent from the SQL enum too — a row carrying one of these is a 23514, so the diff
    // must not construct it even if the form somehow surfaced the control.
    const items = buildSuggestionItems(
      tour,
      { ...draft, completed: true, visibility: 'private', partnerIds: ['c1', 'c2'] },
      GOAL,
    )
    expect(items).toEqual([])
  })

  it('should emit seasons only when the list actually differs', () => {
    expect(buildSuggestionItems(tour, { ...draft, seasons: ['winter'] }, GOAL)).toEqual([])
    expect(
      fieldsOf(buildSuggestionItems(tour, { ...draft, seasons: ['winter', 'spring'] }, GOAL)),
    ).toEqual(['seasons'])
  })

  it('should not read a sub-centimetre coordinate jitter as a moved goal', () => {
    const items = buildSuggestionItems(tour, draft, { lng: 8.2 + 1e-9, lat: 46.8 })
    expect(items).toEqual([])
  })

  it('should emit start_point when only its derived name changed', () => {
    // The name is derived FROM the coordinates, but it is independently editable — a
    // rename with the pin untouched is still a change to the same logical field.
    const items = buildSuggestionItems(tour, { ...draft, startPointName: 'Bergstation' }, GOAL)
    expect(fieldsOf(items)).toEqual(['start_point'])
    expect(itemFor(items, 'start_point')!.value).toEqual({
      lng: 8.1,
      lat: 46.7,
      name: 'Bergstation',
      elevation: 1200,
    })
  })

  it('should emit gpx with the staged path when a track is picked', () => {
    const items = buildSuggestionItems(
      tour,
      { ...draft, gpxFilepath: 'u1/suggestions/t1/abc.gpx' },
      GOAL,
    )
    expect(fieldsOf(items)).toEqual(['gpx'])
    expect(itemFor(items, 'gpx')!.value).toEqual({ storagePath: 'u1/suggestions/t1/abc.gpx' })
  })

  it('should emit a null gpx when the track is removed, never omit it', () => {
    const withTrack = { ...tour, gpxFilepath: 'owner/t1.gpx' }
    const items = buildSuggestionItems(withTrack, { ...draft, gpxFilepath: null }, GOAL)
    expect(fieldsOf(items)).toEqual(['gpx'])
    expect(itemFor(items, 'gpx')!.value).toBeNull()
  })

  it('should keep an add and a remove as separate items so neither cancels the other', () => {
    // D3/D10: the owner may take the new photo without losing the old one, and the swap
    // is what makes a batch accept work on a tour already holding five.
    const items = buildSuggestionItems(tour, draft, GOAL, {
      addedAttachments: [
        { storagePath: 'u1/suggestions/t1/new.jpg', mimeType: 'image/jpeg', sizeBytes: 10, originalFilename: 'new.jpg' },
      ],
      removedAttachmentIds: ['att-1'],
    })

    expect(fieldsOf(items)).toEqual(['attachment_add', 'attachment_remove'])
    expect(itemFor(items, 'attachment_remove')!.targetId).toBe('att-1')
    expect(itemFor(items, 'attachment_remove')!.value).toBeNull()
  })

  it('should carry no targetId on a scalar item', () => {
    // `target_id` scopes D7's auto-decline; a stray one on a scalar field would make two
    // suggestions on the same field stop cancelling each other.
    const items = buildSuggestionItems(tour, { ...draft, notes: 'Beware cornices' }, GOAL)
    expect(itemFor(items, 'notes')!.targetId).toBeUndefined()
  })
})
