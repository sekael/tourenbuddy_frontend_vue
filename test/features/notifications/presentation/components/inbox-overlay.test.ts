import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InboxOverlay from '@/features/notifications/presentation/components/inbox-overlay.vue'

vi.mock('@/core/components/adaptive-overlay.vue', () => ({
  default: { template: '<div><slot name="header-actions" /><slot /></div>' },
}))

const read = {
  id: 'n1',
  type: 'tour_updates',
  action: 'updated',
  actorId: null,
  actorName: 'Jakob',
  tourId: null,
  tourName: 'Piz Ela',
  ref: {},
  occurrences: 1,
  readAt: '2026-10-01T00:00:00Z',
  createdAt: '2026-10-01T00:00:00Z',
}

describe('inboxOverlay', () => {
  it('should disable mark-all and hide "Load more" when nothing is unread and history ended', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: { inbox: { hasMore: false, isLoading: false, error: null } },
    })
    const { useInboxStore } = await import('@/features/notifications/presentation/stores/inbox-store')
    const store = useInboxStore(pinia)
    // @ts-expect-error — overriding a computed for the test
    store.entries = [read]
    const wrapper = mount(InboxOverlay, { global: { plugins: [pinia], stubs: { InboxItem: true } } })

    expect(wrapper.get('[data-testid="mark-all-read"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="load-more"]').exists()).toBe(false)
  })

  it('should show the empty state for an empty inbox', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, initialState: { inbox: { hasMore: false, isLoading: false, error: null } } })
    const wrapper = mount(InboxOverlay, { global: { plugins: [pinia], stubs: { InboxItem: true } } })

    expect(wrapper.find('[data-testid="inbox-empty"]').exists()).toBe(true)
  })
})
