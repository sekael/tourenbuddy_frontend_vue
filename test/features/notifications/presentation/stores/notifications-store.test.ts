import type { NotificationPreferences } from '@/features/notifications/domain/entities/notification-preferences'
import { createPinia, setActivePinia } from 'pinia'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationsStore } from '@/features/notifications/presentation/stores/notifications-store'

const { mockGetPrefs, mockUpdatePrefs, mockCurrentUser } = vi.hoisted(() => ({
  mockGetPrefs: vi.fn(),
  mockUpdatePrefs: vi.fn(),
  mockCurrentUser: {
    value: null as { id: string } | null,
  },
}))

vi.mock('@/features/notifications/data/repositories/notification-preferences-repository-impl', () => ({
  NotificationPreferencesRepositoryImpl: vi.fn().mockImplementation(() => ({
    getPreferences: mockGetPrefs,
    updatePreferences: mockUpdatePrefs,
  })),
}))

vi.mock('@/features/notifications/presentation/composables/use-web-push', () => ({
  useWebPush: vi.fn().mockReturnValue({
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    ensureSubscription: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    get currentUser() {
      return mockCurrentUser.value
    },
  }),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

const defaultPrefs: NotificationPreferences = {
  notifPushEnabled: true,
  notifEmailEnabled: true,
  notifMutedTypes: [],
}

describe('useNotificationsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockCurrentUser.value = null
  })

  it('should have null prefs initially', () => {
    const store = useNotificationsStore()
    expect(store.prefs).toBeNull()
  })

  it('should load prefs on loadPrefs when authenticated', async () => {
    mockCurrentUser.value = { id: 'user-1' }
    mockGetPrefs.mockResolvedValue(defaultPrefs)

    const store = useNotificationsStore()
    await store.loadPrefs()

    expect(mockGetPrefs).toHaveBeenCalledWith('user-1')
    expect(store.prefs).toEqual(defaultPrefs)
  })

  it('should skip loadPrefs when not authenticated', async () => {
    mockCurrentUser.value = null
    const store = useNotificationsStore()
    await store.loadPrefs()
    expect(mockGetPrefs).not.toHaveBeenCalled()
  })

  it('should clear prefs on clear()', () => {
    const store = useNotificationsStore()
    store.prefs = defaultPrefs
    store.clear()
    expect(store.prefs).toBeNull()
  })

  it('should set error on loadPrefs failure', async () => {
    mockCurrentUser.value = { id: 'user-1' }
    mockGetPrefs.mockRejectedValue(new Error('network error'))

    const store = useNotificationsStore()
    await store.loadPrefs()

    expect(store.error).toBeTruthy()
    expect(store.prefs).toBeNull()
  })

  it('should not call updatePreferences if no prefs loaded yet', async () => {
    mockCurrentUser.value = { id: 'user-1' }
    const store = useNotificationsStore()
    // prefs is null
    await store.setEmailEnabled(false)
    expect(mockUpdatePrefs).not.toHaveBeenCalled()
  })

  it('should update email preference and persist', async () => {
    mockCurrentUser.value = { id: 'user-1' }
    mockUpdatePrefs.mockResolvedValue(undefined)
    const store = useNotificationsStore()
    store.prefs = { ...defaultPrefs }

    await store.setEmailEnabled(false)

    expect(mockUpdatePrefs).toHaveBeenCalledWith('user-1', expect.objectContaining({ notifEmailEnabled: false }))
    expect(store.prefs?.notifEmailEnabled).toBe(false)
  })

  it('should mute a type and persist', async () => {
    mockCurrentUser.value = { id: 'user-1' }
    mockUpdatePrefs.mockResolvedValue(undefined)
    const store = useNotificationsStore()
    store.prefs = { ...defaultPrefs, notifMutedTypes: [] }

    await store.setTypeMuted('friend_requests', true)

    expect(store.prefs?.notifMutedTypes).toContain('friend_requests')
  })

  it('should unmute a type and persist', async () => {
    mockCurrentUser.value = { id: 'user-1' }
    mockUpdatePrefs.mockResolvedValue(undefined)
    const store = useNotificationsStore()
    store.prefs = { ...defaultPrefs, notifMutedTypes: ['friend_requests'] }

    await store.setTypeMuted('friend_requests', false)

    expect(store.prefs?.notifMutedTypes).not.toContain('friend_requests')
  })
})
