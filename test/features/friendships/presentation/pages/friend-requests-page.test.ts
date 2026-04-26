import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendRequestsPage from '@/features/friendships/presentation/pages/friend-requests-page.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

vi.mock('@/core/composables/use-snackbar', () => ({
  useSnackbar: () => ({ show: vi.fn() }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    currentUser: null,
    isAuthenticated: false,
  }),
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
  })),
}))

interface RequestRow {
  id: string
  fromUserId: string
  toUserId: string
  status: string
  createdAt: string
  respondedAt: null
}

function makeRow(id: string, from: string, to: string): RequestRow {
  return {
    id,
    fromUserId: from,
    toUserId: to,
    status: 'pending',
    createdAt: new Date().toISOString(),
    respondedAt: null,
  }
}

function mountPage(
  state: {
    incomingRequests?: RequestRow[]
    outgoingRequests?: RequestRow[]
    isLoading?: boolean
  } = {},
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      friendships: {
        incomingRequests: state.incomingRequests ?? [],
        outgoingRequests: state.outgoingRequests ?? [],
        friendships: [],
        isLoading: state.isLoading ?? false,
        error: null,
      },
    },
  })
  const wrapper = mount(FriendRequestsPage, { global: { plugins: [pinia] } })
  const store = useFriendshipsStore()
  return { wrapper, store }
}

describe('friendRequestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show deny-rights note', () => {
    const { wrapper } = mountPage()
    expect(wrapper.find('.deny-rights-note').exists()).toBe(true)
    expect(wrapper.text()).toContain('friendships.inboxDenyRightsNote')
  })

  it('should show empty state when no incoming requests', () => {
    const { wrapper } = mountPage()
    expect(wrapper.text()).toContain('friendships.inboxEmpty')
  })

  it('should render incoming request rows with accept and deny buttons', () => {
    const { wrapper } = mountPage({
      incomingRequests: [makeRow('req-1', 'user-other', 'user-me')],
    })
    expect(wrapper.find('.action-btn--accept').exists()).toBe(true)
    expect(wrapper.find('.action-btn--deny').exists()).toBe(true)
  })

  it('should call accept store action when accept button clicked', async () => {
    const { wrapper, store } = mountPage({
      incomingRequests: [makeRow('req-1', 'user-other', 'user-me')],
    })
    await wrapper.find('.action-btn--accept').trigger('click')
    await vi.waitFor(() => expect(store.accept).toHaveBeenCalledWith('req-1'))
  })

  it('should call deny store action when deny button clicked', async () => {
    const { wrapper, store } = mountPage({
      incomingRequests: [makeRow('req-1', 'user-other', 'user-me')],
    })
    await wrapper.find('.action-btn--deny').trigger('click')
    await vi.waitFor(() => expect(store.deny).toHaveBeenCalledWith('req-1'))
  })

  it('should render outgoing request rows with cancel button', () => {
    const { wrapper } = mountPage({
      outgoingRequests: [makeRow('req-2', 'user-me', 'user-other')],
    })
    expect(wrapper.find('.action-btn--cancel').exists()).toBe(true)
  })

  it('should call cancel store action when cancel button clicked', async () => {
    const { wrapper, store } = mountPage({
      outgoingRequests: [makeRow('req-2', 'user-me', 'user-other')],
    })
    await wrapper.find('.action-btn--cancel').trigger('click')
    await vi.waitFor(() => expect(store.cancel).toHaveBeenCalledWith('req-2'))
  })

  it('should show loading text when isLoading is true', () => {
    const { wrapper } = mountPage({ isLoading: true })
    expect(wrapper.text()).toContain('contacts.list.loading')
    expect(wrapper.find('.action-btn--accept').exists()).toBe(false)
  })
})
