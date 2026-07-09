import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlannedCalendar from '@/features/calendar/presentation/components/planned-calendar.vue'

// The component renders a grid on desktop and a day-tile list on mobile, gated by
// `useIsDesktop()` (matchMedia). Pin the viewport so each suite is deterministic.
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Only the fields the component reads; cast to satisfy the Tour type.
function tour(id: string, name: string, plannedDate: Date | null, extra: object = {}) {
  return { id, name, plannedDate, tourType: 'hiking', ...extra } as any
}

function mountCalendar(tours: any[], friendTours: any[], viewDate = new Date(2024, 5, 1)) {
  return mount(PlannedCalendar, {
    props: { viewDate },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: true,
          initialState: { tours: { tours, friendTours, isLoading: false, error: null } },
        }),
      ],
    },
  })
}

describe('plannedCalendar — desktop grid', () => {
  beforeEach(() => mockMatchMedia(true))

  it('hides own tours without a planned date', () => {
    const wrapper = mountCalendar(
      [tour('t1', 'Has Date', new Date(2024, 5, 15)), tour('t2', 'No Date', null)],
      [],
    )
    const pills = wrapper.findAll('.pill')
    expect(pills).toHaveLength(1)
    expect(wrapper.text()).toContain('Has Date')
    expect(wrapper.text()).not.toContain('No Date')
  })

  it('shows partner friend tours but hides non-partner friend tours', () => {
    const wrapper = mountCalendar(
      [],
      [
        tour('f1', 'Partner Trip', new Date(2024, 5, 20), { isFriendTour: true, isPartner: true }),
        tour('f2', 'Stranger Trip', new Date(2024, 5, 21), { isFriendTour: true, isPartner: false }),
      ],
    )
    expect(wrapper.text()).toContain('Partner Trip')
    expect(wrapper.text()).not.toContain('Stranger Trip')
    // Partner pill carries the friend styling variant.
    expect(wrapper.find('.pill--friend').exists()).toBe(true)
  })

  it('overflows to a "+N more" affordance past the pill cap', () => {
    const day = new Date(2024, 5, 10)
    const wrapper = mountCalendar(
      [tour('a', 'One', day), tour('b', 'Two', day), tour('c', 'Three', day)],
      [],
    )
    // Cap is 2 pills; the third collapses into the overflow affordance.
    expect(wrapper.findAll('.pill')).toHaveLength(2)
    expect(wrapper.find('.pill-more').exists()).toBe(true)
  })

  it('highlights exactly one cell — today — when viewing the current month', () => {
    const wrapper = mountCalendar([], [], new Date())
    expect(wrapper.findAll('.day-cell--today')).toHaveLength(1)
  })

  it('highlights no cell when the current month is not in view', () => {
    // A month far from today: the 6-week window never reaches the current date.
    const wrapper = mountCalendar([], [], new Date(2000, 0, 1))
    expect(wrapper.findAll('.day-cell--today')).toHaveLength(0)
  })
})

describe('plannedCalendar — mobile day-tile list', () => {
  beforeEach(() => mockMatchMedia(false))

  it('renders one row for every day of the month, empty days included', () => {
    // June 2024 has 30 days; the list is month-bounded, so exactly 30 rows.
    const wrapper = mountCalendar([tour('t1', 'Solo', new Date(2024, 5, 15))], [])
    expect(wrapper.findAll('.day-row')).toHaveLength(30)
  })

  it('shows every tour on a busy day with no overflow cap', () => {
    const day = new Date(2024, 5, 10)
    const wrapper = mountCalendar(
      [tour('a', 'One', day), tour('b', 'Two', day), tour('c', 'Three', day)],
      [],
    )
    // Unlike the grid, the list has vertical room — all three show, no "+N more".
    expect(wrapper.findAll('.pill')).toHaveLength(3)
    expect(wrapper.find('.pill-more').exists()).toBe(false)
  })

  it('still drops own tours without a planned date', () => {
    const wrapper = mountCalendar(
      [tour('t1', 'Has Date', new Date(2024, 5, 15)), tour('t2', 'No Date', null)],
      [],
    )
    expect(wrapper.findAll('.pill')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('No Date')
  })

  it('highlights exactly one row — today — when viewing the current month', () => {
    const wrapper = mountCalendar([], [], new Date())
    expect(wrapper.findAll('.day-row--today')).toHaveLength(1)
  })
})
