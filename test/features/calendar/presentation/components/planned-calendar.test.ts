import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PlannedCalendar from '@/features/calendar/presentation/components/planned-calendar.vue'

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

describe('plannedCalendar filtering', () => {
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
      [
        tour('a', 'One', day),
        tour('b', 'Two', day),
        tour('c', 'Three', day),
      ],
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
