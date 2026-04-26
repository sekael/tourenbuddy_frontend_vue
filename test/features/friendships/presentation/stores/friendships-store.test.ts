import type {
  FriendRequest,
  Friendship,
} from '@/features/friendships/data/models/friendship-schemas'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const { mockRepo, mockCurrentUser } = vi.hoisted(() => ({
  mockRepo: {
    sendRequest: vi.fn(),
    accept: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    listIncoming: vi.fn(),
    listFriendships: vi.fn(),
    findUserByPhone: vi.fn(),
    findUsersByPhones: vi.fn(),
  },
  mockCurrentUser: {
    value: null as { id: string, phone_confirmed_at: string | null } | null,
  },
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

function makeRequest(overrides: Partial<FriendRequest> = {}): FriendRequest {
  return {
    id: 'req-1',
    fromUserId: 'user-other',
    toUserId: 'user-me',
    status: 'pending',
    createdAt: new Date().toISOString(),
    respondedAt: null,
    ...overrides,
  }
}

function makeFriendship(a: string, b: string): Friendship {
  const [userAId, userBId] = [a, b].sort() as [string, string]
  return { userAId, userBId, createdAt: new Date().toISOString(), requestId: 'req-1' }
}

/** Creates a verified store and waits for the initial fetchAll to settle. */
async function makeVerifiedStore() {
  mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: '2024-01-01T00:00:00Z' }
  const store = useFriendshipsStore()
  await vi.waitFor(() => expect(store.isLoading).toBe(false))
  return store
}

describe('useFriendshipsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCurrentUser.value = null
    mockRepo.listIncoming.mockResolvedValue([])
    mockRepo.listFriendships.mockResolvedValue([])
  })

  describe('findUserByPhone', () => {
    it('should return null when caller phone is unverified', async () => {
      mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: null }
      const store = useFriendshipsStore()
      const result = await store.findUserByPhone('+41791234567')
      expect(result).toBeNull()
      expect(mockRepo.findUserByPhone).not.toHaveBeenCalled()
    })

    it('should call repo and return userId when caller is verified', async () => {
      mockRepo.findUserByPhone.mockResolvedValue('user-found')
      const store = await makeVerifiedStore()
      const result = await store.findUserByPhone('+41791234567')
      expect(mockRepo.findUserByPhone).toHaveBeenCalledWith('+41791234567')
      expect(result).toBe('user-found')
    })
  })

  describe('findUsersByPhones', () => {
    it('should return empty array when caller is unverified', async () => {
      mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: null }
      const store = useFriendshipsStore()
      const result = await store.findUsersByPhones(['+41791234567'])
      expect(result).toEqual([])
      expect(mockRepo.findUsersByPhones).not.toHaveBeenCalled()
    })

    it('should return empty array for empty phone list', async () => {
      const store = await makeVerifiedStore()
      const result = await store.findUsersByPhones([])
      expect(result).toEqual([])
      expect(mockRepo.findUsersByPhones).not.toHaveBeenCalled()
    })
  })

  describe('sendRequest', () => {
    it('should return null and skip repo when caller is unverified', async () => {
      mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: null }
      const store = useFriendshipsStore()
      const result = await store.sendRequest('user-other')
      expect(result).toBeNull()
      expect(mockRepo.sendRequest).not.toHaveBeenCalled()
    })

    it('should add optimistic request and replace with real one on success', async () => {
      const realReq = makeRequest({ id: 'real-req', fromUserId: 'user-me', toUserId: 'user-other' })
      mockRepo.sendRequest.mockResolvedValue(realReq)
      const store = await makeVerifiedStore()
      const result = await store.sendRequest('user-other')
      expect(result).toEqual(realReq)
      expect(store.outgoingRequests).toHaveLength(1)
      expect(store.outgoingRequests[0]!.id).toBe('real-req')
    })

    it('should roll back optimistic request on failure', async () => {
      mockRepo.sendRequest.mockRejectedValue(new Error('RLS rejected'))
      const store = await makeVerifiedStore()
      await expect(store.sendRequest('user-other')).rejects.toThrow('RLS rejected')
      expect(store.outgoingRequests).toHaveLength(0)
    })
  })

  describe('accept', () => {
    it('should move request from incoming to friendships optimistically', async () => {
      mockRepo.accept.mockResolvedValue(undefined)
      const store = await makeVerifiedStore()
      store.incomingRequests = [
        makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' }),
      ]

      await store.accept('req-1')
      expect(store.incomingRequests).toHaveLength(0)
      expect(store.friendships).toHaveLength(1)
    })

    it('should rollback on accept failure', async () => {
      mockRepo.accept.mockRejectedValue(new Error('failed'))
      const store = await makeVerifiedStore()
      store.incomingRequests = [
        makeRequest({ id: 'req-1', fromUserId: 'user-other', toUserId: 'user-me' }),
      ]

      await expect(store.accept('req-1')).rejects.toThrow('failed')
      expect(store.incomingRequests).toHaveLength(1)
      expect(store.friendships).toHaveLength(0)
    })
  })

  describe('deny', () => {
    it('should remove request optimistically and call repo', async () => {
      mockRepo.deny.mockResolvedValue(undefined)
      const store = await makeVerifiedStore()
      store.incomingRequests = [makeRequest()]

      await store.deny('req-1')
      expect(store.incomingRequests).toHaveLength(0)
    })

    it('should rollback on deny failure', async () => {
      mockRepo.deny.mockRejectedValue(new Error('failed'))
      const store = await makeVerifiedStore()
      store.incomingRequests = [makeRequest()]

      await expect(store.deny('req-1')).rejects.toThrow('failed')
      expect(store.incomingRequests).toHaveLength(1)
    })
  })

  describe('cancel', () => {
    it('should remove outgoing request optimistically and call repo', async () => {
      mockRepo.cancel.mockResolvedValue(undefined)
      const store = await makeVerifiedStore()
      store.outgoingRequests = [
        makeRequest({ id: 'req-1', fromUserId: 'user-me', toUserId: 'user-other' }),
      ]

      await store.cancel('req-1')
      expect(store.outgoingRequests).toHaveLength(0)
    })

    it('should rollback on cancel failure', async () => {
      mockRepo.cancel.mockRejectedValue(new Error('failed'))
      const store = await makeVerifiedStore()
      store.outgoingRequests = [
        makeRequest({ id: 'req-1', fromUserId: 'user-me', toUserId: 'user-other' }),
      ]

      await expect(store.cancel('req-1')).rejects.toThrow('failed')
      expect(store.outgoingRequests).toHaveLength(1)
    })
  })

  describe('friendUserIds', () => {
    it('should return set of friend user IDs for current user', async () => {
      const store = await makeVerifiedStore()
      store.friendships = [makeFriendship('user-me', 'user-a'), makeFriendship('user-me', 'user-b')]
      expect(store.friendUserIds.has('user-a')).toBe(true)
      expect(store.friendUserIds.has('user-b')).toBe(true)
      expect(store.friendUserIds.has('user-me')).toBe(false)
    })

    it('should return empty set when not authenticated', () => {
      mockCurrentUser.value = null
      const store = useFriendshipsStore()
      expect(store.friendUserIds.size).toBe(0)
    })
  })
})
