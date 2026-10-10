import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const route = vi.hoisted(() => ({ query: { notification: 'n1' } as Record<string, unknown> }))
const inbox = vi.hoisted(() => ({
  find: vi.fn(),
  markRead: vi.fn(),
  targetTourId: (e: { tourId: string | null }) => e.tourId,
  canOpenTour: vi.fn(),
}))
const tours = vi.hoisted(() => ({ tours: [], friendTours: [], loadFriendTours: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
vi.mock('@/features/notifications/presentation/stores/inbox-store', () => ({ useInboxStore: () => inbox }))
vi.mock('@/features/tours/presentation/stores/tours-store', () => ({ useToursStore: () => tours }))

const { useInboxNavigation } = await import('@/features/map/presentation/composables/use-inbox-navigation')

function mountNav(tour = vi.fn()) {
  let nav!: ReturnType<typeof useInboxNavigation>
  mount(defineComponent({
    setup: () => {
      nav = useInboxNavigation({ overlay: vi.fn(), tour })
    },
    template: '<div />',
  }))
  return { nav: () => nav, tour }
}

describe('useInboxNavigation', () => {
  it('should tell the user when a deep-linked entry\'s tour is gone, and still mark it read', async () => {
    inbox.find.mockResolvedValue({ id: 'n1', action: 'updated', tourId: 't-gone', ref: {} })
    inbox.canOpenTour.mockReturnValue(false)
    const { nav: getNav, tour } = mountNav()
    await flushPromises()
    const nav = getNav()

    expect(inbox.markRead).toHaveBeenCalledWith('n1')
    expect(tour).not.toHaveBeenCalled()
    expect(nav.snackbar.snackbar.value).toMatchObject({ visible: true, message: 'inbox.unavailable' })
  })

  it('should decide access only after refetching friend tours, so a stale cache grants nothing', async () => {
    route.query = {}
    const order: string[] = []
    tours.loadFriendTours.mockImplementation(async () => {
      order.push('refetch')
    })
    inbox.canOpenTour.mockImplementation(() => {
      order.push('check')
      return false // e.g. removed as partner, or the tour went private
    })
    const { nav, tour } = mountNav()

    await nav().openEntry({ id: 'n2', action: 'updated', tourId: 't1', ref: {} } as never)

    expect(order).toEqual(['refetch', 'check'])
    expect(tour).not.toHaveBeenCalled()
    expect(nav().snackbar.snackbar.value).toMatchObject({ visible: true, message: 'inbox.unavailable' })
  })
})
