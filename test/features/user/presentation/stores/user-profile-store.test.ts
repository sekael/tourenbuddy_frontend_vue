import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvalidPhoneNumberError } from '@/core/exceptions'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const { mockGetUserById, mockUpsertProfile } = vi.hoisted(() => ({
  mockGetUserById: vi.fn(),
  mockUpsertProfile: vi.fn(),
}))

const mockCurrentUser = vi.hoisted(() => ({
  value: {
    id: 'user-123',
    email: 'test@example.com',
    phone: null as string | null,
    phone_confirmed_at: null as string | null,
  },
}))

vi.mock('@/features/user/data/repositories/user-profile-repository-impl', () => ({
  UserProfileRepositoryImpl: vi.fn().mockImplementation(() => ({
    getUserById: mockGetUserById,
    upsertProfile: mockUpsertProfile,
  })),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    get currentUser() {
      return mockCurrentUser.value
    },
  }),
}))

const { mockUpdateUser, mockVerifyOtp } = vi.hoisted(() => ({
  mockUpdateUser: vi.fn().mockResolvedValue({ error: null }),
  mockVerifyOtp: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    auth: {
      updateUser: mockUpdateUser,
      verifyOtp: mockVerifyOtp,
    },
  },
}))

describe('useUserProfileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCurrentUser.value = {
      id: 'user-123',
      email: 'test@example.com',
      phone: null,
      phone_confirmed_at: null,
    }
  })

  describe('loadProfile', () => {
    it('should load existing profile', async () => {
      const mockProfile = { id: 'user-123', firstName: 'Max', lastName: 'Mustermann' }
      mockGetUserById.mockResolvedValue(mockProfile)

      const store = useUserProfileStore()
      await store.loadProfile()

      expect(store.profile).toEqual(mockProfile)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should create profile when none exists', async () => {
      const newProfile = { id: 'user-123', firstName: null, lastName: null }
      mockGetUserById.mockResolvedValue(null)
      mockUpsertProfile.mockResolvedValue(newProfile)

      const store = useUserProfileStore()
      await store.loadProfile()

      expect(mockUpsertProfile).toHaveBeenCalledWith({
        id: 'user-123',
        firstName: null,
        lastName: null,
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
  })

  describe('fullProfile', () => {
    it('should return null when profile is not loaded', () => {
      const store = useUserProfileStore()
      expect(store.fullProfile).toBeNull()
    })

    it('should merge profile and auth data', async () => {
      mockGetUserById.mockResolvedValue({
        id: 'user-123',
        firstName: 'Max',
        lastName: 'Mustermann',
      })
      mockCurrentUser.value = {
        id: 'user-123',
        email: 'test@example.com',
        phone: '+41791234567',
        phone_confirmed_at: '2024-01-01T00:00:00Z',
      }

      const store = useUserProfileStore()
      await store.loadProfile()

      expect(store.fullProfile).toEqual({
        id: 'user-123',
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'test@example.com',
        phoneNumber: '+41791234567',
        phoneVerified: true,
      })
    })

    it('should show phoneVerified false when phone not confirmed', async () => {
      mockGetUserById.mockResolvedValue({
        id: 'user-123',
        firstName: 'Max',
        lastName: 'Mustermann',
      })
      mockCurrentUser.value = {
        id: 'user-123',
        email: 'test@example.com',
        phone: '+41791234567',
        phone_confirmed_at: null,
      }

      const store = useUserProfileStore()
      await store.loadProfile()

      expect(store.fullProfile?.phoneVerified).toBe(false)
    })
  })

  describe('updateProfile', () => {
    it('should call upsertProfile with merged fields', async () => {
      const existing = { id: 'user-123', firstName: 'Max', lastName: null }
      mockGetUserById.mockResolvedValue(existing)
      mockUpsertProfile.mockResolvedValue({ id: 'user-123', firstName: 'Max', lastName: 'Doe' })

      const store = useUserProfileStore()
      await store.loadProfile()
      await store.updateProfile({ lastName: 'Doe' })

      expect(mockUpsertProfile).toHaveBeenLastCalledWith({
        id: 'user-123',
        firstName: 'Max',
        lastName: 'Doe',
      })
    })
  })

  describe('skipOnboarding', () => {
    it('should set sessionSkipped to true', () => {
      const store = useUserProfileStore()
      expect(store.sessionSkipped).toBe(false)
      store.skipOnboarding()
      expect(store.sessionSkipped).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear profile on sign out', async () => {
      const store = useUserProfileStore()
      store.profile = { id: 'user-123', firstName: 'Max', lastName: null }
      store.clear()

      expect(store.profile).toBeNull()
    })

    it('should reset sessionSkipped on clear', () => {
      const store = useUserProfileStore()
      store.skipOnboarding()
      store.clear()
      expect(store.sessionSkipped).toBe(false)
    })
  })

  describe('phone normalization', () => {
    it('sends E.164 to Supabase Auth for Swiss national number', async () => {
      const store = useUserProfileStore()
      await store.sendPhoneVerification('0791234567')
      expect(mockUpdateUser).toHaveBeenCalledWith({ phone: '+41791234567' })
    })

    it('sends E.164 to Supabase Auth for canonical international number', async () => {
      const store = useUserProfileStore()
      await store.sendPhoneVerification('+41 79 123 45 67')
      expect(mockUpdateUser).toHaveBeenCalledWith({ phone: '+41791234567' })
    })

    it('throws InvalidPhoneNumberError for unparseable phone', async () => {
      const store = useUserProfileStore()
      await expect(store.sendPhoneVerification('not-a-number')).rejects.toBeInstanceOf(
        InvalidPhoneNumberError,
      )
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })

    it('verifyPhone sends E.164 to Supabase Auth', async () => {
      const store = useUserProfileStore()
      await store.verifyPhone('+41 79 123 45 67', '123456')
      expect(mockVerifyOtp).toHaveBeenCalledWith(expect.objectContaining({ phone: '+41791234567' }))
    })
  })
})
