import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import FriendRequestsSheet from '@/features/friendships/presentation/components/friend-requests-sheet.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { makeRequest } from '../../_helpers'

const mockSnackbarShow = vi.fn()

vi.mock('@/core/composables/use-snackbar', () => ({
  useSnackbar: () => ({ show: mockSnackbarShow }),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))
vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: null, isAuthenticated: false }),
}))
vi.mock('@/features/friendships/data/repositories/friendship-repository-impl', () => ({
  FriendshipRepositoryImpl: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@/core/components/adaptive-overlay.vue', () => ({
  default: { name: 'AdaptiveOverlay', props: ['title'], template: '<div><slot /></div>' },
}))

interface MountOpts {
  incoming?: ReturnType<typeof makeRequest>[]
  outgoing?: ReturnType<typeof makeRequest>[]
  isLoading?: boolean
  userIdToPhoneMap?: Map<string, string>
  contacts?: Array<{ id: string; contactMethods: Array<{ methodType: string; value: string }> }>
}

function mountSheet(opts: MountOpts = {}) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: true,
    initialState: {
      friendships: {
        incomingRequests: opts.incoming ?? [],
        outgoingRequests: opts.outgoing ?? [],
        friendships: [],
        isLoading: opts.isLoading ?? false,
        error: null,
        userIdToPhoneMap: opts.userIdToPhoneMap ?? new Map(),
      },
      contacts: { contacts: opts.contacts ?? [], isLoading: false, error: null },
    },
  })
  const wrapper = mount(FriendRequestsSheet, { global: { plugins: [pinia] } })
  return { wrapper, friendships: useFriendshipsStore(), contacts: useContactsStore() }
}

async function triggerAccept(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.action-btn--accept').trigger('click')
  await nextTick()
  await wrapper.find('.action-btn--accept').trigger('click')
}

describe('friendRequestsSheet (edges only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering edges', () => {
    it('hides action rows while loading', () => {
      const { wrapper } = mountSheet({ isLoading: true })
      expect(wrapper.find('.action-btn--accept').exists()).toBe(false)
    })

    it('shows empty state when no incoming requests', () => {
      const { wrapper } = mountSheet()
      expect(wrapper.text()).toContain('friendships.inboxEmpty')
    })

    it('shows confirm dialog after clicking accept', async () => {
      const { wrapper } = mountSheet({
        incoming: [makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' })],
      })
      await wrapper.find('.action-btn--accept').trigger('click')
      await nextTick()
      expect(wrapper.find('.confirm-content').exists()).toBe(true)
    })
  })

  describe('error handling shows snackbar', () => {
    it('accept failure surfaces snackbar instead of throwing', async () => {
      const { wrapper, friendships } = mountSheet({
        incoming: [makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' })],
      })
      vi.mocked(friendships.accept).mockRejectedValue(new Error('boom'))
      await triggerAccept(wrapper)
      await flushPromises()
      expect(mockSnackbarShow).toHaveBeenCalled()
    })

    it('deny failure surfaces snackbar', async () => {
      const { wrapper, friendships } = mountSheet({
        incoming: [makeRequest({ id: 'req-1' })],
      })
      vi.mocked(friendships.deny).mockRejectedValue(new Error('boom'))
      await wrapper.find('.action-btn--deny').trigger('click')
      await flushPromises()
      expect(mockSnackbarShow).toHaveBeenCalled()
    })

    it('cancel failure surfaces snackbar', async () => {
      const { wrapper, friendships } = mountSheet({
        outgoing: [makeRequest({ id: 'req-2', fromUserId: 'user-me', toUserId: 'user-other' })],
      })
      vi.mocked(friendships.cancel).mockRejectedValue(new Error('boom'))
      await wrapper.find('.action-btn--cancel').trigger('click')
      await flushPromises()
      expect(mockSnackbarShow).toHaveBeenCalled()
    })
  })

  describe('auto-create contact on accept', () => {
    const PHONE = '+41791234567'

    it('skips addContact when sender phone is not in map (cannot derive display name)', async () => {
      const { wrapper, friendships, contacts } = mountSheet({
        incoming: [makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' })],
        userIdToPhoneMap: new Map(),
      })
      vi.mocked(friendships.accept).mockResolvedValue(undefined)
      await triggerAccept(wrapper)
      await flushPromises()
      expect(contacts.addContact).not.toHaveBeenCalled()
    })

    it('skips addContact when a contact already has the friend phone', async () => {
      const { wrapper, friendships, contacts } = mountSheet({
        incoming: [makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' })],
        userIdToPhoneMap: new Map([['user-other', PHONE]]),
        contacts: [{ id: 'c-1', contactMethods: [{ methodType: 'phone', value: PHONE }] }],
      })
      vi.mocked(friendships.accept).mockResolvedValue(undefined)
      await triggerAccept(wrapper)
      await flushPromises()
      expect(contacts.addContact).not.toHaveBeenCalled()
    })

    it('does not auto-create contact when accept fails', async () => {
      const { wrapper, friendships, contacts } = mountSheet({
        incoming: [makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' })],
        userIdToPhoneMap: new Map([['user-other', PHONE]]),
      })
      vi.mocked(friendships.accept).mockRejectedValue(new Error('rls'))
      await triggerAccept(wrapper)
      await flushPromises()
      expect(contacts.addContact).not.toHaveBeenCalled()
    })
  })
})
