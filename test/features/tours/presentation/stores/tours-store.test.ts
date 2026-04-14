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
    tourType: null,
    elevation: null,
    gpxTrack: null,
    description: null,
    seasons: null,
    startPoint: null,
    endPoint: null,
    equipment: null,
    notes: null,
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

  it('should create tour with minimal draft and reload', async () => {
    mockCreateTour.mockResolvedValue(undefined)
    mockListTours.mockResolvedValue(mockTours)

    const store = useToursStore()
    await store.createTourFromDraft(
      {
        name: 'Test',
        plannedDate: null,
        partnerIds: [],
        tourType: null,
        elevation: null,
        gpxTrack: null,
        description: null,
        seasons: null,
        startPoint: null,
        endPoint: null,
        equipment: null,
        notes: null,
      },
      { lng: 8.2, lat: 46.8 },
    )

    expect(mockCreateTour).toHaveBeenCalledWith(
      'mock-uuid-123',
      expect.objectContaining({ name: 'Test' }),
      { lng: 8.2, lat: 46.8 },
    )
    expect(mockListTours).toHaveBeenCalledTimes(1)
  })

  it('should create tour with all extended fields', async () => {
    mockCreateTour.mockResolvedValue(undefined)
    mockListTours.mockResolvedValue(mockTours)

    const store = useToursStore()
    await store.createTourFromDraft(
      {
        name: 'Rigi',
        plannedDate: new Date('2026-07-15'),
        partnerIds: ['contact-1'],
        tourType: 'hiking',
        elevation: 1798,
        gpxTrack: null,
        description: 'Great hike',
        seasons: ['summer'],
        startPoint: { lng: 8.4, lat: 47.0 },
        endPoint: null,
        equipment: 'Boots, poles',
        notes: 'Start early',
      },
      { lng: 8.4845, lat: 47.0564 },
    )

    expect(mockCreateTour).toHaveBeenCalledWith(
      'mock-uuid-123',
      expect.objectContaining({
        tourType: 'hiking',
        elevation: 1798,
        seasons: ['summer'],
        equipment: 'Boots, poles',
      }),
      { lng: 8.4845, lat: 47.0564 },
    )
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
