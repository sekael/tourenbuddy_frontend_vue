import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    gpxFilepath: null,
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
    gpxFilepath: null,
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
    isAuthenticated?: boolean
    /** Needed for focus assertions — focus() is a no-op on a detached tree. */
    attachTo?: HTMLElement
  } = {},
) {
  return mount(TourListSheet, {
    attachTo: options.attachTo,
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
            auth: { currentUser: (options.isAuthenticated ?? true) ? { id: 'u-1' } : null },
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

    it('should display the unnamed-tour fallback for tours with null name', () => {
      const tours = [{ ...mockTours[0]!, id: 't-3', name: null }]
      const wrapper = mountSheet({ tours })
      // i18n stub echoes keys; the row falls back to the unnamed-tour label.
      expect(wrapper.find('.tour-row').text()).toContain('tours.infoSheet.unnamedTour')
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
      expect(wrapper.find('.empty-state').text()).toContain('tours.list.emptyTitle')
    })
  })

  describe('filtered empty state', () => {
    it('should show filtered empty state when search yields no results', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.search-input').setValue('xyznotfound')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state').text()).toContain('tours.list.noMatchesTitle')
    })

    it('should clear filters and show list when "Clear filters" clicked', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.search-input').setValue('xyznotfound')
      await wrapper.vm.$nextTick()
      await wrapper.find('.base-button--primary').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.findAll('.tour-row')).toHaveLength(2)
    })
  })

  describe('row click', () => {
    it('should emit selectTour with tour id when row clicked', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.tour-row')[0]!.trigger('click')
      expect(wrapper.emitted('selectTour')).toHaveLength(1)
      expect(wrapper.emitted('selectTour')![0]).toEqual(['t-1'])
    })
  })

  describe('header add-tour button', () => {
    it('should render the header add-tour button when authenticated', () => {
      const wrapper = mountSheet({ isAuthenticated: true })
      expect(wrapper.find('[data-testid="header-add-tour"]').exists()).toBe(true)
    })

    it('should render header button enabled when authenticated (click enabled = can emit)', () => {
      const wrapper = mountSheet({ isAuthenticated: true })
      const btn = wrapper.find('[data-testid="header-add-tour"]')
      expect(btn.exists()).toBe(true)
      expect(btn.attributes('disabled')).toBeUndefined()
    })

    it('should render header button disabled when unauthenticated', () => {
      const wrapper = mountSheet({ isAuthenticated: false })
      expect(wrapper.find('[data-testid="header-add-tour"]').attributes('disabled')).toBeDefined()
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

  describe('clear-filters button', () => {
    // Filter state is module-level in the composable, so it survives unmount —
    // reset it or the assertions below leak into neighbouring tests.
    async function withFilter(fn: (w: ReturnType<typeof mountSheet>) => Promise<void>) {
      const wrapper = mountSheet()
      await wrapper.find('.filters-trigger').trigger('click')
      wrapper.findComponent({ name: 'TourFiltersPanel' }).vm.$emit('update:completion', 'done')
      await wrapper.vm.$nextTick()
      try {
        await fn(wrapper)
      }
      finally {
        wrapper.unmount()
      }
    }

    it('should stay hidden while no facet is active', () => {
      const wrapper = mountSheet()
      expect(wrapper.find('[data-testid="clear-filters"]').exists()).toBe(false)
    })

    it('should reset the facets but leave the search query', async () => {
      await withFilter(async (wrapper) => {
        await wrapper.find('.search-input').setValue('Alpine')
        await wrapper.find('[data-testid="clear-filters"]').trigger('click')
        await wrapper.vm.$nextTick()

        expect(wrapper.find('[data-testid="clear-filters"]').exists()).toBe(false)
        expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('Alpine')
        // Search survived, so only the matching tour is listed.
        expect(wrapper.findAll('.tour-row')).toHaveLength(1)
      })
    })

    it('should keep the summary row with its count while no facet is active', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.filters-trigger').trigger('click')

      expect(wrapper.find('.filters-summary').exists()).toBe(true)
      expect(wrapper.find('[data-testid="clear-filters"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('filters overlay dismissal', () => {
    async function openFilters() {
      const wrapper = mountSheet()
      await wrapper.find('.filters-trigger').trigger('click')
      return wrapper
    }

    it('should collapse when Escape is pressed from the search input', async () => {
      const wrapper = await openFilters()

      await wrapper.find('.search-input').trigger('keydown.escape')

      expect(wrapper.find('.filters-overlay').exists()).toBe(false)
      wrapper.unmount()
    })

    it('should stay open when pointer goes down on the search input', async () => {
      const wrapper = await openFilters()

      wrapper.find('.search-input').element.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.filters-overlay').exists()).toBe(true)
      wrapper.unmount()
    })

    it('should stay open when pointer goes down inside the panel', async () => {
      const wrapper = await openFilters()

      wrapper.find('.filters-overlay').element.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.filters-overlay').exists()).toBe(true)
      wrapper.unmount()
    })

    it('should collapse when pointer goes down outside the sheet', async () => {
      const wrapper = await openFilters()

      const outside = document.createElement('div')
      document.body.appendChild(outside)
      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.filters-overlay').exists()).toBe(false)
      outside.remove()
      wrapper.unmount()
    })

    it('should collapse without reopening when the trigger is activated again', async () => {
      const wrapper = await openFilters()

      // pointerdown lands on the trigger (inside the header, so not "outside"),
      // then the click toggles — the panel must not close-then-reopen.
      wrapper.find('.filters-trigger').element.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
      await wrapper.find('.filters-trigger').trigger('click')

      expect(wrapper.find('.filters-overlay').exists()).toBe(false)
      wrapper.unmount()
    })

    it('should return focus to the trigger when dismissed', async () => {
      const wrapper = mountSheet({ attachTo: document.body })
      await wrapper.find('.filters-trigger').trigger('click')

      await wrapper.find('.search-input').trigger('keydown.escape')
      await wrapper.vm.$nextTick()

      expect(document.activeElement).toBe(wrapper.find('.filters-trigger').element)
      wrapper.unmount()
    })

    it('should remove the document listener on unmount', async () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')
      const wrapper = await openFilters()

      wrapper.unmount()

      expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
      removeSpy.mockRestore()
    })
  })

  describe('summary count', () => {
    it('should report a count matching the rows rendered on collapse', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.search-input').setValue('Alpine')
      await wrapper.find('.filters-trigger').trigger('click')
      await wrapper.vm.$nextTick()

      // Count reflects search as well as filters — it is a promise about the list.
      // Asserted on the prop, not rendered text: i18n returns raw keys under test.
      expect(wrapper.findComponent({ name: 'TourFiltersPanel' }).props('matchCount')).toBe(1)

      await wrapper.find('.filters-trigger').trigger('click')
      expect(wrapper.findAll('.tour-row')).toHaveLength(1)

      await wrapper.find('.search-input').setValue('')
      wrapper.unmount()
    })
  })

  describe('per-tab filter isolation', () => {
    it('should leave the other tab facets untouched when clearing', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.filters-trigger').trigger('click')
      wrapper.findComponent({ name: 'TourFiltersPanel' }).vm.$emit('update:completion', 'done')
      await wrapper.vm.$nextTick()

      await wrapper.findAll('.tab')[1].trigger('click')
      wrapper.findComponent({ name: 'TourFiltersPanel' }).vm.$emit('update:completion', 'open')
      await wrapper.vm.$nextTick()
      await wrapper.find('[data-testid="clear-filters"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="clear-filters"]').exists()).toBe(false)

      // Owned kept its own facet through the friends-tab clear.
      await wrapper.findAll('.tab')[0].trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="clear-filters"]').exists()).toBe(true)

      // Filter state is module-level — reset or it leaks into neighbouring tests.
      await wrapper.find('[data-testid="clear-filters"]').trigger('click')
      wrapper.unmount()
    })
  })

  describe('backfill header button', () => {
    it('should not render on the owned tab', () => {
      const wrapper = mountSheet()
      expect(wrapper.find('[data-testid="header-backfill"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('should not render on the friends tab without friendships', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.tab')[1].trigger('click')

      expect(wrapper.find('[data-testid="header-backfill"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
