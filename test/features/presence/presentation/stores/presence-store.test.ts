import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPresenceChannel } from '@/features/presence/data/services/presence-channel'
import { usePresenceStore } from '@/features/presence/presentation/stores/presence-store'

const FRIEND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
const ME_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

const { mockDestroy, mockGetStates, mockAwareness, mockProvider } = vi.hoisted(() => {
  let changeHandler: (() => void) | null = null
  const mockGetStates = vi.fn(() => new Map<number, Record<string, unknown>>())
  const mockAwareness = {
    clientID: 1,
    on: vi.fn((event: string, fn: () => void) => {
      if (event === 'change')
        changeHandler = fn
    }),
    off: vi.fn((event: string, fn: () => void) => {
      if (event === 'change' && changeHandler === fn)
        changeHandler = null
    }),
    getStates: mockGetStates,
    setLocalStateField: vi.fn(),
    setLocalState: vi.fn(),
    emitChange() {
      changeHandler?.()
    },
  }
  const mockProvider = {
    getAwareness: vi.fn(() => mockAwareness),
    destroy: vi.fn(),
  }
  const mockDestroy = vi.fn()
  return { mockDestroy, mockGetStates, mockAwareness, mockProvider }
})

vi.mock('@/features/presence/data/services/presence-channel', () => ({
  createPresenceChannel: vi.fn(() => mockProvider as never),
  destroyPresenceChannel: mockDestroy,
}))

const mockCurrentUser = ref<{ id: string, phone_confirmed_at: string | null } | null>(null)

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    get currentUser() {
      return mockCurrentUser.value
    },
    get isAuthenticated() {
      return mockCurrentUser.value != null
    },
  })),
}))

const friendIds = ref(new Set<string>())

vi.mock('@/features/friendships/presentation/stores/friendships-store', () => ({
  useFriendshipsStore: vi.fn(() => ({
    /** Match Pinia-unwrapped `ComputedRef<Set>`: plain `Set` with reactive swaps via `friendIds`. */
    get friendUserIds() {
      return friendIds.value
    },
  })),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}))

describe('usePresenceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCurrentUser.value = null
    friendIds.value = new Set()
    mockGetStates.mockReset()
    mockProvider.getAwareness.mockClear()
    mockProvider.destroy.mockClear()
    mockDestroy.mockClear()
    mockAwareness.setLocalStateField.mockClear()
    mockAwareness.setLocalState.mockClear()
  })

  it('does not connect until eligible and map session attached', async () => {
    mockCurrentUser.value = { id: ME_ID, phone_confirmed_at: '2024-01-01T00:00:00Z' }
    friendIds.value = new Set([FRIEND_ID])
    const store = usePresenceStore()
    expect(createPresenceChannel).not.toHaveBeenCalled()
    store.attachMapSession()
    await vi.waitFor(() => expect(createPresenceChannel).toHaveBeenCalled())
    store.detachMapSession()
    await vi.waitFor(() => expect(mockDestroy).toHaveBeenCalled())
  })

  it('filters remote awareness to friends only', async () => {
    mockCurrentUser.value = { id: ME_ID, phone_confirmed_at: '2024-01-01T00:00:00Z' }
    friendIds.value = new Set([FRIEND_ID])
    mockGetStates.mockImplementation(() => {
      const m = new Map<number, Record<string, unknown>>()
      m.set(2, {
        user: {
          id: FRIEND_ID,
          name: 'Friend',
          color: '#e63946',
        },
        cursor: { lon: 8.1, lat: 46.7, t: 1 },
      })
      m.set(3, {
        user: {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
          name: 'Stranger',
          color: '#2a9d8f',
        },
        cursor: { lon: 9, lat: 47, t: 2 },
      })
      return m
    })

    const store = usePresenceStore()
    store.attachMapSession()
    await vi.waitFor(() => expect(mockAwareness.on).toHaveBeenCalled())
    mockAwareness.emitChange()
    expect(store.friendCursors.has(FRIEND_ID)).toBe(true)
    expect(store.friendCursors.has('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33')).toBe(false)
    store.detachMapSession()
  })

  it('removes cursor when friendship ends', async () => {
    mockCurrentUser.value = { id: ME_ID, phone_confirmed_at: '2024-01-01T00:00:00Z' }
    friendIds.value = new Set([FRIEND_ID])
    mockGetStates.mockImplementation(() => {
      const m = new Map<number, Record<string, unknown>>()
      m.set(2, {
        user: { id: FRIEND_ID, name: 'Friend', color: '#e63946' },
        cursor: { lon: 8, lat: 46, t: 1 },
      })
      return m
    })
    const store = usePresenceStore()
    store.attachMapSession()
    await vi.waitFor(() => expect(mockAwareness.on).toHaveBeenCalled())
    mockAwareness.emitChange()
    expect(store.friendCursors.has(FRIEND_ID)).toBe(true)
    friendIds.value = new Set()
    await vi.waitFor(() => expect(store.friendCursors.has(FRIEND_ID)).toBe(false))
    store.detachMapSession()
  })
})
