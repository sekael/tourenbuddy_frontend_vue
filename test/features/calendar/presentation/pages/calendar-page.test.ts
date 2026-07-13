import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import ExtendedFab from '@/core/components/extended-fab.vue'
import CalendarNav from '@/features/calendar/presentation/components/calendar-nav.vue'
import CalendarPage from '@/features/calendar/presentation/pages/calendar-page.vue'
import { useAvailabilityStore } from '@/features/calendar/presentation/stores/availability-store'

const replace = vi.fn()
const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace, push }),
}))

function mountPage(editing: boolean) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: true,
    initialState: {
      tours: { tours: [], friendTours: [], isLoading: false, error: null },
      availability: { editing, savedDays: new Set(), workingDays: new Set(), saving: false, error: null },
    },
  })
  const wrapper = mount(CalendarPage, { shallow: true, global: { plugins: [pinia] } })
  return { wrapper, store: useAvailabilityStore(pinia) }
}

describe('calendarPage — availability edit lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enters edit mode when the availability FAB is clicked', () => {
    const { wrapper, store } = mountPage(false)
    wrapper.findComponent(ExtendedFab).vm.$emit('click')
    expect(store.enterEdit).toHaveBeenCalledTimes(1)
  })

  it('discards an in-progress edit when switching views — no prompt', () => {
    const { wrapper, store } = mountPage(true)
    wrapper.findComponent(CalendarNav).vm.$emit('select', 'seasons')
    expect(store.cancel).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ name: 'calendar', query: { view: 'seasons' } })
  })

  it('discards an in-progress edit when navigating back to the map', () => {
    const { wrapper, store } = mountPage(true)
    wrapper.findComponent(BaseIconButton).vm.$emit('click')
    expect(store.cancel).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ name: 'map' })
  })

  it('does not call cancel on view switch when not editing', () => {
    const { wrapper, store } = mountPage(false)
    wrapper.findComponent(CalendarNav).vm.$emit('select', 'seasons')
    expect(store.cancel).not.toHaveBeenCalled()
  })
})
