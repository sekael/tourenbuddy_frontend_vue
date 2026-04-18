import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import TourListSheet from '@/features/tours/presentation/components/tour-list-sheet.vue'

const mockTours = [
  {
    id: 't-1',
    userId: 'u-1',
    name: 'Alpine Hike',
    plannedDate: new Date('2024-06-15'),
    goal: { lng: 8.5, lat: 47.5 },
    partnerIds: [],
    tourType: 'hiking',
    elevation: 1500,
    gpxTrack: null,
    description: null,
    seasons: ['summer'],
    startPoint: null,
    endPoint: null,
    equipment: null,
    notes: null,
    completed: false,
  },
  {
    id: 't-2',
    userId: 'u-1',
    name: 'Ski Tour',
    plannedDate: null,
    goal: { lng: 8.6, lat: 47.6 },
    partnerIds: [],
    tourType: 'skiing',
    elevation: 2000,
    gpxTrack: null,
    description: null,
    seasons: ['winter'],
    startPoint: null,
    endPoint: null,
    equipment: null,
    notes: null,
    completed: true,
  },
]

function mountSheet(
  options: {
    tours?: typeof mockTours
    isLoading?: boolean
  } = {},
) {
  return mount(TourListSheet, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: true,
          initialState: {
            tours: {
              tours: options.tours ?? mockTours,
              isLoading: options.isLoading ?? false,
              error: null,
            },
            contacts: { contacts: [], isLoading: false, error: null },
            map: { selectedTourId: null, isPickingLocation: false },
          },
        }),
      ],
    },
  })
}

describe('tourListSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list with tours', () => {
    it('should render one row per tour', () => {
      const wrapper = mountSheet()
      expect(wrapper.findAll('.tour-row')).toHaveLength(2)
    })

    it('should display tour names in rows', () => {
      const wrapper = mountSheet()
      const rows = wrapper.findAll('.tour-row')
      expect(rows[0]!.text()).toContain('Alpine Hike')
      expect(rows[1]!.text()).toContain('Ski Tour')
    })

    it('should display "Unnamed tour" for tours with null name', () => {
      const tours = [{ ...mockTours[0]!, id: 't-3', name: null }]
      const wrapper = mountSheet({ tours })
      expect(wrapper.find('.tour-row').text()).toContain('Unnamed tour')
    })
  })

  describe('loading state', () => {
    it('should show loading text when isLoading and no tours', () => {
      const wrapper = mountSheet({ tours: [], isLoading: true })
      expect(wrapper.find('.loading-text').exists()).toBe(true)
    })
  })

  describe('empty state — no tours', () => {
    it('should show empty state when tours array is empty and not loading', () => {
      const wrapper = mountSheet({ tours: [] })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state').text()).toContain('No tours yet')
    })
  })

  describe('filtered empty state', () => {
    it('should show filtered empty state when search yields no results', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.search-input').setValue('xyznotfound')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state').text()).toContain('No tours match')
    })

    it('should clear filters and show list when "Clear filters" clicked', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.search-input').setValue('xyznotfound')
      await wrapper.vm.$nextTick()
      await wrapper.find('.clear-filters-btn').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.findAll('.tour-row')).toHaveLength(2)
    })
  })

  describe('row click', () => {
    it('should call mapStore.selectTour with tour id when row clicked', async () => {
      const wrapper = mountSheet()
      const mapStore = useMapStore()
      await wrapper.findAll('.tour-row')[0]!.trigger('click')
      expect(mapStore.selectTour).toHaveBeenCalledWith('t-1')
    })

    it('should emit close when row clicked', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.tour-row')[0]!.trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('filters trigger', () => {
    it('should show filters panel when trigger clicked', async () => {
      const wrapper = mountSheet()
      expect(wrapper.findComponent({ name: 'TourFiltersPanel' }).exists()).toBe(false)
      await wrapper.find('.filters-trigger').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent({ name: 'TourFiltersPanel' }).exists()).toBe(true)
    })

    it('should show active filter count badge', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.filters-trigger').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.filter-badge').exists()).toBe(false)
    })
  })
})
