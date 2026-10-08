import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const route = vi.hoisted(() => ({ query: { notification: 'n1' } as Record<string, unknown> }))
const inbox = vi.hoisted(() => ({ find: vi.fn(), markRead: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
vi.mock('@/features/notifications/presentation/stores/inbox-store', () => ({ useInboxStore: () => inbox }))
vi.mock('@/features/tours/presentation/stores/tours-store', () => ({ useToursStore: () => ({ tours: [], friendTours: [] }) }))

const { useInboxNavigation } = await import('@/features/map/presentation/composables/use-inbox-navigation')

describe('useInboxNavigation', () => {
  it('should tell the user when a deep-linked entry\'s tour is gone, and still mark it read', async () => {
    inbox.find.mockResolvedValue({ id: 'n1', action: 'updated', tourId: 't-gone', ref: {} })
    const tour = vi.fn()
    let nav!: ReturnType<typeof useInboxNavigation>
    mount(defineComponent({
      setup: () => {
        nav = useInboxNavigation({ overlay: vi.fn(), tour })
      },
      template: '<div />',
    }))
    await flushPromises()

    expect(inbox.markRead).toHaveBeenCalledWith('n1')
    expect(tour).not.toHaveBeenCalled()
    expect(nav.snackbar.snackbar.value).toMatchObject({ visible: true, message: 'inbox.unavailable' })
  })
})
