import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const { mockListTours, mockCreateTour } = vi.hoisted(() => ({
  mockListTours: vi.fn(),
  mockCreateTour: vi.fn(),
}))

vi.mock('@/features/tours/data/repositories/tours-repository-impl', () => ({
  ToursRepositoryImpl: vi.fn().mockImplementation(() => ({
    listToursForUser: mockListTours,
    createTourWithPartners: mockCreateTour,
  })),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    currentUser: { id: 'user-123' },
    isAuthenticated: true,
  }),
}))

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-123'),
}))

const mockTours = [
  {
    id: 'tour-1',
    userId: 'user-123',
    plannedDate: null,
    goal: { lng: 8.2, lat: 46.8 },
    name: 'Rigi Tour',
    partnerIds: [],
  },
]

describe('useToursStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should load tours from repository', async () => {
    mockListTours.mockResolvedValue(mockTours)

    const store = useToursStore()
    await store.loadTours()

    expect(store.tours).toEqual(mockTours)
    expect(store.isLoading).toBe(false)
  })

  it('should create tour and reload', async () => {
    mockCreateTour.mockResolvedValue(undefined)
    mockListTours.mockResolvedValue(mockTours)

    const store = useToursStore()
    await store.createTourFromDraft(
      { name: 'Test', plannedDate: null, partnerIds: [] },
      { lng: 8.2, lat: 46.8 },
    )

    expect(mockCreateTour).toHaveBeenCalledWith(
      'mock-uuid-123',
      expect.objectContaining({ name: 'Test' }),
      { lng: 8.2, lat: 46.8 },
    )
    expect(mockListTours).toHaveBeenCalledTimes(1)
  })

  it('should set error on load failure', async () => {
    mockListTours.mockRejectedValue(new Error('Query failed'))

    const store = useToursStore()
    await store.loadTours()

    expect(store.error).toBe('Query failed')
    expect(store.tours).toHaveLength(0)
  })

  it('should clear tours', () => {
    const store = useToursStore()
    store.tours = [...mockTours]
    store.clear()

    expect(store.tours).toHaveLength(0)
  })
})
