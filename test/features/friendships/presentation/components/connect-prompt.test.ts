import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectPrompt from '@/features/friendships/presentation/components/connect-prompt.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))
vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: null, isAuthenticated: false }),
}))
vi.mock('@/features/friendships/data/repositories/friendship-repository-impl', () => ({
  FriendshipRepositoryImpl: vi.fn().mockImplementation(() => ({
    sendRequest: vi.fn(),
    accept: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    listIncoming: vi.fn().mockResolvedValue([]),
    listFriendships: vi.fn().mockResolvedValue([]),
    findUserByPhone: vi.fn(),
    findUsersByPhones: vi.fn(),
    findPhonesByUserIds: vi.fn().mockResolvedValue([]),
    removeFriendship: vi.fn(),
  })),
}))

function mountPrompt(beforeSend?: () => Promise<void>) {
  return mount(ConnectPrompt, {
    props: { matchedUserId: 'user-42', ...(beforeSend ? { beforeSend } : {}) },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })],
    },
  })
}

describe('connectPrompt', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('beforeSend hook', () => {
    it('should await beforeSend before calling sendRequest when hook resolves', async () => {
      const callOrder: string[] = []
      const beforeSend = vi.fn(async () => {
        callOrder.push('hook')
      })
      const wrapper = mountPrompt(beforeSend)
      const store = useFriendshipsStore()
      vi.mocked(store.sendRequest).mockImplementation(async () => {
        callOrder.push('send')
      })

      await wrapper.find('.btn-primary').trigger('click')
      await flushPromises()

      expect(callOrder).toEqual(['hook', 'send'])
      expect(store.sendRequest).toHaveBeenCalledWith('user-42')
    })

    it('should NOT call sendRequest when beforeSend rejects', async () => {
      const beforeSend = vi.fn().mockRejectedValue(new Error('Save failed'))
      const wrapper = mountPrompt(beforeSend)
      const store = useFriendshipsStore()

      await wrapper.find('.btn-primary').trigger('click')
      await flushPromises()

      expect(store.sendRequest).not.toHaveBeenCalled()
      expect(wrapper.find('.error-text').text()).toBe('Save failed')
    })

    it('should leave buttons interactive after beforeSend rejects for retry', async () => {
      const beforeSend = vi.fn().mockRejectedValue(new Error('oops'))
      const wrapper = mountPrompt(beforeSend)

      await wrapper.find('.btn-primary').trigger('click')
      await flushPromises()

      const sendBtn = wrapper.find('.btn-primary')
      const dismissBtn = wrapper.find('.btn-secondary')
      expect((sendBtn.element as HTMLButtonElement).disabled).toBe(false)
      expect((dismissBtn.element as HTMLButtonElement).disabled).toBe(false)
    })

    it('should call sendRequest directly when no beforeSend prop is provided', async () => {
      const wrapper = mountPrompt()
      const store = useFriendshipsStore()
      vi.mocked(store.sendRequest).mockResolvedValue(undefined as never)

      await wrapper.find('.btn-primary').trigger('click')
      await flushPromises()

      expect(store.sendRequest).toHaveBeenCalledWith('user-42')
    })
  })

  describe('error surfacing', () => {
    it('should show sendRequest error message when request fails', async () => {
      const wrapper = mountPrompt()
      const store = useFriendshipsStore()
      vi.mocked(store.sendRequest).mockRejectedValue(new Error('network error'))

      await wrapper.find('.btn-primary').trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-text').text()).toBe('network error')
    })
  })
})
