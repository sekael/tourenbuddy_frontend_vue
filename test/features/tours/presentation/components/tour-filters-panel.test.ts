import type { TourFilters } from '@/features/tours/presentation/composables/use-tour-filters'
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TourFiltersPanel from '@/features/tours/presentation/components/tour-filters-panel.vue'
import { TOUR_FILL } from '../../../../fixtures/tour-fill'

// The tours store kicks a friend-tour load when signed in: keep it pending, off the network,
// so it never overwrites the seeded friend tours.
vi.mock('@/features/tours/data/repositories/tours-repository-impl', () => ({
  ToursRepositoryImpl: vi.fn().mockImplementation(() => ({ listFriendTours: () => new Promise(() => {}) })),
}))

const tour = (over: Record<string, unknown>) => ({ ...TOUR_FILL, id: 't', userId: 'u-me', name: 'T', goal: { lng: 8, lat: 46 }, partnerIds: [], tourTypes: [], completed: false, ...over })

function filters(over: Partial<TourFilters> = {}): TourFilters {
  return {
    partnerIds: new Set(),
    ownerIds: new Set(),
    tourTypes: new Set(),
    gradeRanges: [],
    seasons: new Set(),
    dateRange: { from: null, to: null },
    completion: 'all',
    ...over,
  }
}

function mountPanel(opts: { tab: 'owned' | 'friends', tours?: unknown[], friendTours?: unknown[], filters?: TourFilters, contactsLoaded?: boolean }) {
  return mount(TourFiltersPanel, {
    props: { filters: opts.filters ?? filters(), tab: opts.tab, tours: (opts.tours ?? []) as any, matchCount: 0, canClear: false },
    global: {
      plugins: [createTestingPinia({
        createSpy: vi.fn,
        initialState: {
          tours: { tours: [], friendTours: opts.friendTours ?? [] },
          contacts: { contacts: [{ id: 'c-1', firstName: 'Ana', lastName: null, displayName: null, contactMethods: [] }], hasLoaded: opts.contactsLoaded ?? true },
          auth: { currentUser: { id: 'u-me' } },
        },
      })],
    },
  })
}

function chipTexts(wrapper: ReturnType<typeof mountPanel>, testid: string) {
  return wrapper.find(`[data-testid="${testid}"]`).findAll('button').map(b => b.text())
}

describe('tourFiltersPanel', () => {
  describe('friends-tab people', () => {
    const friendTours = [
      tour({ id: 'f-1', userId: 'u-zoe', isFriendTour: true, partnerNames: [{ userId: 'u-bea', firstName: 'Bea', lastName: 'K' }, { userId: 'u-me', firstName: 'Me', lastName: null }] }),
      tour({ id: 'f-2', userId: 'u-amy', isFriendTour: true, partnerNames: [] }),
    ]

    it('should hold the people chips until names settle, so labels never swap', async () => {
      const wrapper = mountPanel({ tab: 'friends', friendTours, contactsLoaded: false })
      await flushPromises()
      expect(wrapper.find('[data-testid="owner-filter"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="partner-filter"]').exists()).toBe(false)
    })

    it('should offer the viewer as "Me" first, then partners by profile name when no contact resolves', async () => {
      const wrapper = mountPanel({ tab: 'friends', friendTours })
      await flushPromises()
      expect(chipTexts(wrapper, 'partner-filter')).toEqual(['tours.infoSheet.partnerSelf', 'Bea K'])
    })

    it('should keep a selected friend with no tours offered and lit, so it can be cleared', async () => {
      const wrapper = mountPanel({ tab: 'friends', friendTours: [], filters: filters({ ownerIds: new Set(['u-lena']) }) })
      await flushPromises()
      const chip = wrapper.find('[data-testid="owner-filter"] button')
      expect(chip.attributes('aria-pressed')).toBe('true')
      await chip.trigger('click')
      expect([...(wrapper.emitted('update:ownerIds')![0]![0] as Set<string>)]).toEqual([])
    })

    it('should offer no recorded-by filter on My Tours, and contacts as partners there', async () => {
      const wrapper = mountPanel({ tab: 'owned', friendTours })
      await flushPromises()
      expect(wrapper.find('[data-testid="owner-filter"]').exists()).toBe(false)
      expect(chipTexts(wrapper, 'partner-filter')).toEqual(['Ana'])
    })
  })

  describe('grade', () => {
    it('should hide the grade filter when no tour carries a closed-scale grade', () => {
      const wrapper = mountPanel({ tab: 'owned', tours: [tour({ grade: '5c' }), tour({ grade: null })] })
      expect(wrapper.find('[data-testid="grade-filter"]').exists()).toBe(false)
    })

    it('should offer only scales in use, plus a scale still holding a range', () => {
      const wrapper = mountPanel({
        tab: 'owned',
        tours: [tour({ grade: 'T3' })],
        filters: filters({ gradeRanges: [{ from: 'S1', to: 'S2' }] }),
      })
      const rows = wrapper.find('[data-testid="grade-filter"]').findAll('[role="group"]')
      expect(rows.map(r => r.findAll('button')[0]!.text())).toEqual(['T1', 'S0'])
      expect(rows[1]!.findAll('button[aria-pressed="true"]').map(b => b.text())).toEqual(['S1', 'S2'])
    })

    it('should widen a lone pick to the second tap', async () => {
      const wrapper = mountPanel({ tab: 'owned', tours: [tour({ grade: 'T3' })], filters: filters({ gradeRanges: [{ from: 'T4', to: 'T4' }] }) })
      await wrapper.findAll('[data-testid="grade-filter"] button').find(b => b.text() === 'T2')!.trigger('click')
      expect(wrapper.emitted('update:gradeRanges')![0]![0]).toEqual([{ from: 'T2', to: 'T4' }])
    })
  })
})
