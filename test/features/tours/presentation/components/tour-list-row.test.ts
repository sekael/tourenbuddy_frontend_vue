import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TourListRow from '@/features/tours/presentation/components/tour-list-row.vue'

// Row identity: the activity type icon (never a letter), and an owner name that is either
// final or a skeleton — never the fallback shown first and swapped later.

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: () => new Promise(() => {}),
  })),
}))

function makeTour(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    userId: 'owner-1',
    name: 'Ridge Loop',
    plannedDate: null,
    goal: { lng: 8.5, lat: 47.5 },
    partnerIds: [],
    tourType: 'hiking',
    elevation: null,
    gpxFilepath: null,
    description: null,
    seasons: null,
    startPoint: null,
    endPoint: null,
    equipment: null,
    notes: null,
    completed: false,
    ...overrides,
  } as any
}

function mountRow(tour: ReturnType<typeof makeTour>) {
  return mount(TourListRow, {
    props: { tour },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      stubs: { BaseIcon: { props: ['name'], template: '<i :data-icon="name" />' } },
    },
  })
}

describe('tourListRow', () => {
  it('renders the generic tour icon for a typeless tour, never a letter', () => {
    const wrapper = mountRow(makeTour({ tourType: null, name: null }))

    expect(wrapper.find('.tour-avatar [data-icon="tour"]').exists()).toBe(true)
    // The old letter avatar rendered '?' for an unnamed tour — an identity that isn't one.
    expect(wrapper.find('.tour-avatar').text()).not.toContain('?')
    expect(wrapper.find('.tour-avatar').attributes('style')).toBeUndefined()
  })

  it('tints the avatar per activity type', () => {
    const wrapper = mountRow(makeTour({ tourType: 'skiing' }))

    expect(wrapper.find('.tour-avatar [data-icon="downhill_skiing"]').exists()).toBe(true)
    expect(wrapper.find('.tour-avatar').attributes('style')).toContain('--avatar-tint')
  })

  it('holds a skeleton instead of the fallback while the owner is unresolved', () => {
    const wrapper = mountRow(makeTour({ isFriendTour: true }))

    expect(wrapper.find('.tour-owner-skeleton').exists()).toBe(true)
    expect(wrapper.find('.tour-owner').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('aFriend')
  })

  it('renders no owner slot at all for the viewer\'s own tour', () => {
    const wrapper = mountRow(makeTour())

    expect(wrapper.find('.tour-owner-skeleton').exists()).toBe(false)
    expect(wrapper.find('.tour-owner').exists()).toBe(false)
  })
})
