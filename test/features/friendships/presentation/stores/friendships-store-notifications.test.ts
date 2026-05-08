import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { makeRequest } from '../../_helpers'

const { mockRepo, mockCurrentUser, mockNotifyReceived, mockNotifyResponded } = vi.hoisted(() => ({
  mockRepo: {
    sendRequest: vi.fn(),
    accept: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    listIncoming: vi.fn().mockResolvedValue([]),
    listFriendships: vi.fn().mockResolvedValue([]),
    findUserByPhone: vi.fn(),
    findUsersByPhones: vi.fn(),
    findPhonesByUserIds: vi.fn(),
    removeFriendship: vi.fn(),
  },
  mockCurrentUser: {
    value: null as { id: string, phone_confirmed_at: string | null } | null,
  },
  mockNotifyReceived: vi.fn(),
  mockNotifyResponded: vi.fn(),
}))

vi.mock('@/features/friendships/data/repositories/friendship-repository-impl', () => ({
  FriendshipRepositoryImpl: vi.fn().mockImplementation(() => mockRepo),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    get currentUser() {
      return mockCurrentUser.value
    },
    get isAuthenticated() {
      return mockCurrentUser.value != null
    },
  }),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

vi.mock('@/features/notifications/data/notify-dispatch', () => ({
  notifyFriendRequestReceived: mockNotifyReceived,
  notifyFriendRequestResponded: mockNotifyResponded,
}))

async function verifiedStore() {
  mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: '2024-01-01T00:00:00Z' }
  const store = useFriendshipsStore()
  await vi.waitFor(() => expect(store.isLoading).toBe(false))
  return store
}

describe('useFriendshipsStore — notification dispatch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCurrentUser.value = null
    mockRepo.listIncoming.mockResolvedValue([])
    mockRepo.listFriendships.mockResolvedValue([])
  })

  it('should dispatch notifyFriendRequestReceived after successful sendRequest', async () => {
    const created = { id: 'req-created', fromUserId: 'user-me', toUserId: 'user-b', status: 'pending', createdAt: '', respondedAt: null }
    mockRepo.sendRequest.mockResolvedValue(created)

    const store = await verifiedStore()
    await store.sendRequest('user-b')

    expect(mockNotifyReceived).toHaveBeenCalledWith('req-created')
  })

  it('should not dispatch notifyFriendRequestReceived when sendRequest RPC fails', async () => {
    mockRepo.sendRequest.mockRejectedValue(new Error('RPC failed'))

    const store = await verifiedStore()
    await expect(store.sendRequest('user-b')).rejects.toThrow('RPC failed')

    expect(mockNotifyReceived).not.toHaveBeenCalled()
  })

  it('should dispatch notifyFriendRequestResponded after successful accept', async () => {
    mockRepo.accept.mockResolvedValue(undefined)
    const store = await verifiedStore()
    store.incomingRequests = [makeRequest()]

    await store.accept('req-1')

    expect(mockNotifyResponded).toHaveBeenCalledWith('req-1')
  })

  it('should not dispatch notifyFriendRequestResponded when accept RPC fails', async () => {
    mockRepo.accept.mockRejectedValue(new Error('failed'))
    const store = await verifiedStore()
    store.incomingRequests = [makeRequest()]

    await expect(store.accept('req-1')).rejects.toThrow('failed')

    expect(mockNotifyResponded).not.toHaveBeenCalled()
  })

  it('should dispatch notifyFriendRequestResponded after successful deny', async () => {
    mockRepo.deny.mockResolvedValue(undefined)
    const store = await verifiedStore()
    store.incomingRequests = [makeRequest()]

    await store.deny('req-1')

    expect(mockNotifyResponded).toHaveBeenCalledWith('req-1')
  })

  it('should not dispatch notifyFriendRequestResponded when deny RPC fails', async () => {
    mockRepo.deny.mockRejectedValue(new Error('failed'))
    const store = await verifiedStore()
    store.incomingRequests = [makeRequest()]

    await expect(store.deny('req-1')).rejects.toThrow('failed')

    expect(mockNotifyResponded).not.toHaveBeenCalled()
  })
})
