import type { Tour } from '@/features/tours/domain/entities/tour'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useTourFilters } from '@/features/tours/presentation/composables/use-tour-filters'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const baseTour: Tour = {
  id: '1',
  userId: 'u-1',
  name: 'Alpine Hike',
  plannedDate: new Date('2024-06-15'),
  goal: { lng: 8.5, lat: 47.5 },
  partnerIds: [],
  tourType: 'hiking',
  elevation: 1500,
  gpxFilepath: null,
  description: null,
  seasons: ['summer'],
  startPoint: null,
  endPoint: null,
  equipment: null,
  notes: null,
  completed: false,
}

function makeTour(overrides: Partial<Tour>): Tour {
  return { ...baseTour, ...overrides }
}

describe('useTourFilters', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: () => () => {} })
    setActivePinia(pinia)
    // Reset module-level filter state between tests
    const { clearAll } = useTourFilters()
    clearAll()
  })

  function setup(
    tours: Tour[],
    contacts: {
      id: string
      firstName: string
      lastName: string | null
      displayName: string | null
    }[] = [],
  ) {
    const toursStore = useToursStore()
    const contactsStore = useContactsStore()
    toursStore.tours = tours as any
    contactsStore.contacts = contacts.map(c => ({
      ...c,
      userId: 'u-1',
      contactMethods: [],
    })) as any
    return useTourFilters()
  }

  describe('search', () => {
    it('should return all tours when query is empty', () => {
      const tours = [makeTour({ id: '1', name: 'Alpine Hike' })]
      const { filteredTours } = setup(tours)
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should return all tours when query is whitespace only', () => {
      const tours = [makeTour({ id: '1', name: 'Alpine Hike' })]
      const { filteredTours, searchQuery } = setup(tours)
      searchQuery.value = '   '
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should match tour name case-insensitively', () => {
      const tours = [makeTour({ id: '1', name: 'Alpine Hike' })]
      const { filteredTours, searchQuery } = setup(tours)
      searchQuery.value = 'alpine'
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should match partial tour name', () => {
      const tours = [
        makeTour({ id: '1', name: 'Alpine Hike' }),
        makeTour({ id: '2', name: 'Ski Tour' }),
      ]
      const { filteredTours, searchQuery } = setup(tours)
      searchQuery.value = 'ski'
      expect(filteredTours.value).toHaveLength(1)
      expect(filteredTours.value[0]!.id).toBe('2')
    })

    it('should match partner display name', () => {
      const tours = [makeTour({ id: '1', name: 'Hike', partnerIds: ['c-1'] })]
      const contacts = [{ id: 'c-1', firstName: 'Anna', lastName: 'Meier', displayName: 'Annie' }]
      const { filteredTours, searchQuery } = setup(tours, contacts)
      searchQuery.value = 'annie'
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should match partner full name when no display name', () => {
      const tours = [makeTour({ id: '1', name: 'Hike', partnerIds: ['c-1'] })]
      const contacts = [{ id: 'c-1', firstName: 'Bob', lastName: 'Müller', displayName: null }]
      const { filteredTours, searchQuery } = setup(tours, contacts)
      searchQuery.value = 'müller'
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should not match unnamed tour by name search', () => {
      const tours = [makeTour({ id: '1', name: null, partnerIds: [] })]
      const { filteredTours, searchQuery } = setup(tours)
      searchQuery.value = 'alpine'
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should match unnamed tour via partner name', () => {
      const tours = [makeTour({ id: '1', name: null, partnerIds: ['c-1'] })]
      const contacts = [{ id: 'c-1', firstName: 'Anna', lastName: null, displayName: null }]
      const { filteredTours, searchQuery } = setup(tours, contacts)
      searchQuery.value = 'anna'
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should treat missing contact as empty string without error', () => {
      const tours = [makeTour({ id: '1', name: null, partnerIds: ['ghost-id'] })]
      const { filteredTours, searchQuery } = setup(tours)
      searchQuery.value = 'ghost'
      expect(filteredTours.value).toHaveLength(0)
    })
  })

  describe('partner filter', () => {
    it('should include tour when partnerIds intersect filter', () => {
      const tours = [makeTour({ id: '1', partnerIds: ['c-1', 'c-2'] })]
      const { filteredTours, filters } = setup(tours)
      filters.partnerIds = new Set(['c-1'])
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should exclude tour when no partnerIds intersect filter', () => {
      const tours = [makeTour({ id: '1', partnerIds: ['c-2'] })]
      const { filteredTours, filters } = setup(tours)
      filters.partnerIds = new Set(['c-1'])
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should pass all tours when partner filter is empty', () => {
      const tours = [makeTour({ id: '1', partnerIds: [] })]
      const { filteredTours } = setup(tours)
      expect(filteredTours.value).toHaveLength(1)
    })
  })

  describe('activity-type filter', () => {
    it('should include tour matching tourType', () => {
      const tours = [makeTour({ id: '1', tourType: 'hiking' })]
      const { filteredTours, filters } = setup(tours)
      filters.tourTypes = new Set(['hiking'])
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should exclude tour with different tourType', () => {
      const tours = [makeTour({ id: '1', tourType: 'skiing' })]
      const { filteredTours, filters } = setup(tours)
      filters.tourTypes = new Set(['hiking'])
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should exclude tour with null tourType when filter is active', () => {
      const tours = [makeTour({ id: '1', tourType: null })]
      const { filteredTours, filters } = setup(tours)
      filters.tourTypes = new Set(['hiking'])
      expect(filteredTours.value).toHaveLength(0)
    })
  })

  describe('season filter', () => {
    it('should include tour when seasons intersect', () => {
      const tours = [makeTour({ id: '1', seasons: ['summer', 'autumn'] })]
      const { filteredTours, filters } = setup(tours)
      filters.seasons = new Set(['summer'])
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should exclude tour when seasons do not intersect', () => {
      const tours = [makeTour({ id: '1', seasons: ['winter'] })]
      const { filteredTours, filters } = setup(tours)
      filters.seasons = new Set(['summer'])
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should exclude tour with null seasons when filter is active', () => {
      const tours = [makeTour({ id: '1', seasons: null })]
      const { filteredTours, filters } = setup(tours)
      filters.seasons = new Set(['summer'])
      expect(filteredTours.value).toHaveLength(0)
    })
  })

  describe('planned-date filter', () => {
    it('should include tour within date range', () => {
      const tours = [makeTour({ id: '1', plannedDate: new Date('2024-06-15') })]
      const { filteredTours, filters } = setup(tours)
      filters.dateRange.from = new Date('2024-06-01')
      filters.dateRange.to = new Date('2024-06-30')
      expect(filteredTours.value).toHaveLength(1)
    })

    it('should exclude tour before from date', () => {
      const tours = [makeTour({ id: '1', plannedDate: new Date('2024-05-01') })]
      const { filteredTours, filters } = setup(tours)
      filters.dateRange.from = new Date('2024-06-01')
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should exclude tour after to date', () => {
      const tours = [makeTour({ id: '1', plannedDate: new Date('2024-07-01') })]
      const { filteredTours, filters } = setup(tours)
      filters.dateRange.to = new Date('2024-06-30')
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should exclude tour with null plannedDate when bound is set', () => {
      const tours = [makeTour({ id: '1', plannedDate: null })]
      const { filteredTours, filters } = setup(tours)
      filters.dateRange.from = new Date('2024-06-01')
      expect(filteredTours.value).toHaveLength(0)
    })

    it('should include tour with null plannedDate when no bounds', () => {
      const tours = [makeTour({ id: '1', plannedDate: null })]
      const { filteredTours } = setup(tours)
      expect(filteredTours.value).toHaveLength(1)
    })
  })

  describe('completion filter', () => {
    it('should include all tours when completion is "all"', () => {
      const tours = [
        makeTour({ id: '1', completed: true }),
        makeTour({ id: '2', completed: false }),
      ]
      const { filteredTours } = setup(tours)
      expect(filteredTours.value).toHaveLength(2)
    })

    it('should include only completed tours when completion is "done"', () => {
      const tours = [
        makeTour({ id: '1', completed: true }),
        makeTour({ id: '2', completed: false }),
      ]
      const { filteredTours, filters } = setup(tours)
      filters.completion = 'done'
      expect(filteredTours.value).toHaveLength(1)
      expect(filteredTours.value[0]!.id).toBe('1')
    })

    it('should include only incomplete tours when completion is "open"', () => {
      const tours = [
        makeTour({ id: '1', completed: true }),
        makeTour({ id: '2', completed: false }),
      ]
      const { filteredTours, filters } = setup(tours)
      filters.completion = 'open'
      expect(filteredTours.value).toHaveLength(1)
      expect(filteredTours.value[0]!.id).toBe('2')
    })
  })

  describe('combined search and filters', () => {
    it('should apply both search and filters together', () => {
      const tours = [
        makeTour({ id: '1', name: 'Alpine Hike', tourType: 'hiking', completed: false }),
        makeTour({ id: '2', name: 'Alpine Ski', tourType: 'skiing', completed: false }),
      ]
      const { filteredTours, searchQuery, filters } = setup(tours)
      searchQuery.value = 'alpine'
      filters.tourTypes = new Set(['hiking'])
      expect(filteredTours.value).toHaveLength(1)
      expect(filteredTours.value[0]!.id).toBe('1')
    })
  })

  describe('activeFilterCount', () => {
    it('should be 0 when no filters active', () => {
      const { activeFilterCount } = setup([])
      expect(activeFilterCount.value).toBe(0)
    })

    it('should count partner filter as 1', () => {
      const { activeFilterCount, filters } = setup([])
      filters.partnerIds = new Set(['c-1'])
      expect(activeFilterCount.value).toBe(1)
    })

    it('should count two active filter categories as 2', () => {
      const { activeFilterCount, filters } = setup([])
      filters.partnerIds = new Set(['c-1'])
      filters.completion = 'done'
      expect(activeFilterCount.value).toBe(2)
    })

    it('should not count search in activeFilterCount', () => {
      const { activeFilterCount, searchQuery } = setup([])
      searchQuery.value = 'test'
      expect(activeFilterCount.value).toBe(0)
    })
  })

  describe('clearAll', () => {
    it('should reset search and all filters', () => {
      const tours = [makeTour({ id: '1', name: 'Hike', tourType: 'hiking' })]
      const { filteredTours, searchQuery, filters, activeFilterCount, clearAll } = setup(tours)
      searchQuery.value = 'xyz'
      filters.tourTypes = new Set(['skiing'])
      filters.completion = 'done'
      expect(filteredTours.value).toHaveLength(0)
      clearAll()
      expect(searchQuery.value).toBe('')
      expect(activeFilterCount.value).toBe(0)
      expect(filteredTours.value).toHaveLength(1)
    })
  })
})
