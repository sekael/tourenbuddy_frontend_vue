import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlannedCalendar from '@/features/calendar/presentation/components/planned-calendar.vue'
import { TOUR_TYPE_COLORS } from '@/features/tours/data/models/tour-type'

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
    // Pills are colored by tour type (matching mobile), not by friend/own — the
    // partner pill's background is its hiking color, with no friend variant.
    expect(wrapper.find('.pill--friend').exists()).toBe(false)
    expect(wrapper.find('.pill').attributes('style')).toContain(TOUR_TYPE_COLORS.hiking)
  })

  it('collapses multiple tours into a single count chip (no individual pill)', () => {
    const day = new Date(2024, 5, 10)
    const wrapper = mountCalendar(
      [tour('a', 'One', day), tour('b', 'Two', day), tour('c', 'Three', day)],
      [],
    )
    // >1 tour → one generic count chip, no individual pill; the cell opens the list.
    expect(wrapper.find('.pill').exists()).toBe(false)
    expect(wrapper.findAll('.count-chip')).toHaveLength(1)
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

  it('collapses multiple tours into a single count chip (no individual pill)', () => {
    const day = new Date(2024, 5, 10)
    const wrapper = mountCalendar(
      [tour('a', 'One', day), tour('b', 'Two', day), tour('c', 'Three', day)],
      [],
    )
    // Same collapse as the grid; the row opens the day-detail list for the rest.
    expect(wrapper.find('.pill').exists()).toBe(false)
    expect(wrapper.findAll('.count-chip')).toHaveLength(1)
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

  it('scrolls the list to a day when its detail is re-opened (back-navigation)', async () => {
    const day = new Date(2024, 5, 15)
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const wrapper = mountCalendar([tour('t1', 'Solo', day)], [])

    ;(wrapper.vm as any).openDetailForDay(day)
    await wrapper.vm.$nextTick()

    expect(spy).toHaveBeenCalled()
    expect((spy.mock.instances[0] as Element).getAttribute('data-day')).toBe('2024-06-15')
    spy.mockRestore()
  })
})
