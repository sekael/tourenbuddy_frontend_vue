import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const {
  mockListTours,
  mockCreateTour,
  mockUpdateTour,
  mockPatchCompleted,
  mockDeleteTour,
  mockDebug,
  mockError,
} = vi.hoisted(() => ({
  mockListTours: vi.fn(),
  mockCreateTour: vi.fn(),
  mockUpdateTour: vi.fn(),
  mockPatchCompleted: vi.fn(),
  mockDeleteTour: vi.fn(),
  mockDebug: vi.fn(),
  mockError: vi.fn(),
}))

vi.mock('@/features/tours/data/repositories/tours-repository-impl', () => ({
  ToursRepositoryImpl: vi.fn().mockImplementation(() => ({
    listToursForUser: mockListTours,
    createTourWithPartners: mockCreateTour,
    updateTour: mockUpdateTour,
    patchCompleted: mockPatchCompleted,
    deleteTour: mockDeleteTour,
  })),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: vi.fn().mockReturnValue({
    debug: mockDebug,
    error: mockError,
    info: vi.fn(),
    warn: vi.fn(),
  }),
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
    completed: false,
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

  it('should create tour with minimal draft, reload, and return new id', async () => {
    mockCreateTour.mockResolvedValue(undefined)
    mockListTours.mockResolvedValue(mockTours)

    const store = useToursStore()
    const result = await store.createTourFromDraft(
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

    expect(result).toBe('mock-uuid-123')
    expect(mockCreateTour).toHaveBeenCalledWith(
      'mock-uuid-123',
      expect.objectContaining({ name: 'Test' }),
      { lng: 8.2, lat: 46.8 },
    )
    expect(mockListTours).toHaveBeenCalledTimes(1)
  })

  it('should return null from createTourFromDraft when unauthenticated', async () => {
    const { useAuthStore } = await import('@/features/auth/presentation/stores/auth-store')
    vi.mocked(useAuthStore).mockReturnValueOnce({
      currentUser: null,
      isAuthenticated: false,
    } as never)

    const store = useToursStore()
    const result = await store.createTourFromDraft(
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

    expect(result).toBeNull()
    expect(mockCreateTour).not.toHaveBeenCalled()
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

  describe('updateTour', () => {
    it('should replace the updated tour in the local list on success', async () => {
      mockUpdateTour.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [...mockTours]

      const updatedDraft = {
        name: 'Rigi Updated',
        plannedDate: null,
        partnerIds: [],
        tourType: null,
        elevation: 1800,
        gpxTrack: null,
        description: null,
        seasons: null,
        startPoint: null,
        endPoint: null,
        equipment: null,
        notes: null,
      }
      const newGoal = { lng: 8.3, lat: 46.9 }

      await store.updateTour('tour-1', updatedDraft, newGoal)

      expect(store.tours).toHaveLength(1)
      expect(store.tours[0]?.name).toBe('Rigi Updated')
      expect(store.tours[0]?.elevation).toBe(1800)
      expect(store.tours[0]?.goal).toEqual(newGoal)
    })

    it('should leave the list unchanged and re-throw on repository error', async () => {
      mockUpdateTour.mockRejectedValue(new Error('RPC failed'))

      const store = useToursStore()
      store.tours = [...mockTours]

      await expect(
        store.updateTour(
          'tour-1',
          {
            name: 'X',
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
        ),
      ).rejects.toThrow('RPC failed')

      expect(store.tours[0]?.name).toBe('Rigi Tour')
    })
  })

  describe('setCompleted', () => {
    it('should optimistically update completed to true and call repository', async () => {
      mockPatchCompleted.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [...mockTours]

      await store.setCompleted('tour-1', true)

      expect(store.tours[0]?.completed).toBe(true)
      expect(mockPatchCompleted).toHaveBeenCalledWith('tour-1', true)
    })

    it('should optimistically update completed to false', async () => {
      mockPatchCompleted.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [{ ...mockTours[0]!, completed: true }]

      await store.setCompleted('tour-1', false)

      expect(store.tours[0]?.completed).toBe(false)
      expect(mockPatchCompleted).toHaveBeenCalledWith('tour-1', false)
    })

    it('should roll back and set error on repository failure', async () => {
      mockPatchCompleted.mockRejectedValue(new Error('patch failed'))

      const store = useToursStore()
      store.tours = [...mockTours]

      await store.setCompleted('tour-1', true)

      expect(store.tours[0]?.completed).toBe(false)
      expect(store.error).toBe('patch failed')
    })

    it('should emit a debug log on toggle', async () => {
      mockPatchCompleted.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [...mockTours]

      await store.setCompleted('tour-1', true)

      expect(mockDebug).toHaveBeenCalledWith('setCompleted', { tourId: 'tour-1', completed: true })
    })

    it('should do nothing when tourId not found', async () => {
      const store = useToursStore()
      store.tours = [...mockTours]

      await store.setCompleted('nonexistent', true)

      expect(mockPatchCompleted).not.toHaveBeenCalled()
    })
  })

  describe('deleteTour', () => {
    it('should remove the tour from the local list on success', async () => {
      mockDeleteTour.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [...mockTours]

      await store.deleteTour('tour-1')

      expect(store.tours).toHaveLength(0)
    })

    it('should leave the list unchanged and re-throw on repository error', async () => {
      mockDeleteTour.mockRejectedValue(new Error('Delete failed'))

      const store = useToursStore()
      store.tours = [...mockTours]

      await expect(store.deleteTour('tour-1')).rejects.toThrow('Delete failed')
      expect(store.tours).toHaveLength(1)
    })
  })
})
