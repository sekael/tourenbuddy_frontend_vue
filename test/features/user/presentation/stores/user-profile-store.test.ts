import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const { mockGetUserById, mockUpsertProfile } = vi.hoisted(() => ({
  mockGetUserById: vi.fn(),
  mockUpsertProfile: vi.fn(),
}))

vi.mock('@/features/user/data/repositories/user-profile-repository-impl', () => ({
  UserProfileRepositoryImpl: vi.fn().mockImplementation(() => ({
    getUserById: mockGetUserById,
    upsertProfile: mockUpsertProfile,
  })),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    currentUser: { id: 'user-123' },
  }),
}))

describe('useUserProfileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should load existing profile', async () => {
    const mockProfile = {
      id: 'user-123',
      firstName: 'Max',
      lastName: 'Mustermann',
      dateOfBirth: null,
    }
    mockGetUserById.mockResolvedValue(mockProfile)

    const store = useUserProfileStore()
    await store.loadProfile()

    expect(store.profile).toEqual(mockProfile)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('should create profile when none exists', async () => {
    const newProfile = { id: 'user-123', firstName: null, lastName: null, dateOfBirth: null }
    mockGetUserById.mockResolvedValue(null)
    mockUpsertProfile.mockResolvedValue(newProfile)

    const store = useUserProfileStore()
    await store.loadProfile()

    expect(mockUpsertProfile).toHaveBeenCalledWith({
      id: 'user-123',
      firstName: null,
      lastName: null,
      dateOfBirth: null,
    })
    expect(store.profile).toEqual(newProfile)
  })

  it('should set error on failure', async () => {
    mockGetUserById.mockRejectedValue(new Error('DB error'))

    const store = useUserProfileStore()
    await store.loadProfile()

    expect(store.error).toBe('DB error')
    expect(store.profile).toBeNull()
  })

  it('should clear profile on sign out', async () => {
    const store = useUserProfileStore()
    store.profile = { id: 'user-123', firstName: 'Max', lastName: null, dateOfBirth: null }
    store.clear()

    expect(store.profile).toBeNull()
  })
})
