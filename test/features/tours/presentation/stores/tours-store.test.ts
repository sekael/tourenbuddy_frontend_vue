import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const {
  mockListTours,
  mockCreateTour,
  mockUpdateTour,
  mockPatchCompleted,
  mockDeleteTour,
  mockDeleteContact,
  mockDebug,
  mockError,
  mockNotifyTourDeleted,
} = vi.hoisted(() => ({
  mockListTours: vi.fn(),
  mockCreateTour: vi.fn(),
  mockUpdateTour: vi.fn(),
  mockPatchCompleted: vi.fn(),
  mockDeleteTour: vi.fn(),
  mockDeleteContact: vi.fn(),
  mockDebug: vi.fn(),
  mockError: vi.fn(),
  mockNotifyTourDeleted: vi.fn(),
}))

vi.mock('@/features/notifications/data/notify-dispatch', () => ({
  notifyTourChanged: vi.fn(),
  notifyTourDeleted: mockNotifyTourDeleted,
  notifyTourInterest: vi.fn(),
}))

vi.mock('@/features/tours/data/repositories/tours-repository-impl', () => ({
  ToursRepositoryImpl: vi.fn().mockImplementation(() => ({
    listToursForUser: mockListTours,
    createTourWithPartners: mockCreateTour,
    updateTour: mockUpdateTour,
    patchGpxFilepath: vi.fn().mockResolvedValue(undefined),
    patchCompleted: mockPatchCompleted,
    deleteTour: mockDeleteTour,
  })),
}))

vi.mock('@/features/tours/data/services/gpx-storage-service', () => ({
  uploadGpx: vi.fn().mockResolvedValue('user-123/mock-uuid-123.gpx'),
  removeGpx: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn(),
  downloadOriginal: vi.fn(),
}))

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: vi.fn().mockResolvedValue([]),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: mockDeleteContact,
  })),
}))

vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({
    addMethod: vi.fn(),
    updateMethod: vi.fn(),
    removeMethod: vi.fn(),
    setPrimaryPhone: vi.fn(),
  })),
}))

vi.mock('@/core/utils/phone-normalize', () => ({
  normalizePhone: vi.fn().mockReturnValue({ ok: false }),
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
    gpxFilepath: null,
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
        gpxFilepath: null,
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
        gpxFilepath: null,
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
        gpxFilepath: null,
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
    it('should store pre-uploaded gpxFilepath from draft without calling uploadGpx', async () => {
      const { uploadGpx } = await import('@/features/tours/data/services/gpx-storage-service')
      mockUpdateTour.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [...mockTours]

      await store.updateTour(
        'tour-1',
        {
          name: 'Rigi',
          plannedDate: null,
          partnerIds: [],
          tourType: null,
          elevation: null,
          gpxFilepath: 'user-123/pre-uploaded-uuid.gpx',
          description: null,
          seasons: null,
          startPoint: null,
          endPoint: null,
          equipment: null,
          notes: null,
        },
        { lng: 8.2, lat: 46.8 },
      )

      expect(uploadGpx).not.toHaveBeenCalled()
      expect(store.tours[0]?.gpxFilepath).toBe('user-123/pre-uploaded-uuid.gpx')
    })

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
        gpxFilepath: null,
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
            gpxFilepath: null,
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

    it('should pass only newly-added partner contact ids to notifyTourChanged', async () => {
      const { notifyTourChanged } = await import('@/features/notifications/data/notify-dispatch')
      mockUpdateTour.mockResolvedValue(undefined)

      const store = useToursStore()
      // Existing tour already has contact-1 as a partner.
      store.tours = [{ ...mockTours[0]!, partnerIds: ['contact-1'], visibility: 'friends' }]

      await store.updateTour(
        'tour-1',
        {
          name: 'Rigi Tour',
          plannedDate: null,
          partnerIds: ['contact-1', 'contact-2'],
          tourType: null,
          elevation: null,
          gpxFilepath: null,
          description: null,
          seasons: null,
          startPoint: null,
          endPoint: null,
          equipment: null,
          notes: null,
          visibility: 'friends',
        },
        { lng: 8.2, lat: 46.8 },
      )

      // Only contact-2 is new; contact-1 was already a partner.
      expect(notifyTourChanged).toHaveBeenCalledWith('tour-1', 'updated', ['contact-2'])
    })

    it('should pass an empty added-partner list when the partner set is unchanged', async () => {
      const { notifyTourChanged } = await import('@/features/notifications/data/notify-dispatch')
      mockUpdateTour.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [{ ...mockTours[0]!, partnerIds: ['contact-1'], visibility: 'friends' }]

      await store.updateTour(
        'tour-1',
        {
          name: 'Rigi Renamed', // meaningful change so a notification still fires
          plannedDate: null,
          partnerIds: ['contact-1'],
          tourType: null,
          elevation: null,
          gpxFilepath: null,
          description: null,
          seasons: null,
          startPoint: null,
          endPoint: null,
          equipment: null,
          notes: null,
          visibility: 'friends',
        },
        { lng: 8.2, lat: 46.8 },
      )

      expect(notifyTourChanged).toHaveBeenCalledWith('tour-1', 'updated', [])
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

    it('should call loadTours on repository failure (convergence over local rollback)', async () => {
      mockPatchCompleted.mockRejectedValue(new Error('patch failed'))
      mockListTours.mockResolvedValue(mockTours)

      const store = useToursStore()
      store.tours = [...mockTours]

      await store.setCompleted('tour-1', true)

      // loadTours() is called to resync from server; it clears error on success
      expect(mockListTours).toHaveBeenCalled()
      // tours is back to server state (mockTours has completed: false)
      expect(store.tours[0]?.completed).toBe(false)
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

    it('should notify partners with cached contact ids when deleting a shareable tour', async () => {
      mockDeleteTour.mockResolvedValue(undefined)

      const store = useToursStore()
      store.tours = [
        { ...mockTours[0], partnerIds: ['contact-jakob'], visibility: 'friends', name: 'Gfroren Hora' },
      ]

      await store.deleteTour('tour-1')

      expect(mockNotifyTourDeleted).toHaveBeenCalledWith(['contact-jakob'], 'Gfroren Hora')
    })
  })

  describe('partnerIds reconciliation on contact deletion', () => {
    const tourWithPartner = {
      id: 'tour-a',
      userId: 'user-123',
      plannedDate: null,
      goal: { lng: 8.2, lat: 46.8 },
      name: 'Alpine Tour',
      partnerIds: ['contact-deleted', 'contact-kept'],
      tourType: null,
      elevation: 1200,
      gpxFilepath: null,
      description: 'A great tour',
      seasons: null,
      startPoint: null,
      endPoint: null,
      equipment: null,
      notes: null,
      completed: false,
    }

    const tourWithoutPartner = {
      id: 'tour-b',
      userId: 'user-123',
      plannedDate: null,
      goal: { lng: 7.1, lat: 46.5 },
      name: 'Valley Tour',
      partnerIds: ['contact-kept'],
      tourType: null,
      elevation: null,
      gpxFilepath: null,
      description: null,
      seasons: null,
      startPoint: null,
      endPoint: null,
      equipment: null,
      notes: null,
      completed: false,
    }

    it('should remove deleted contact id from all affected cached tours', async () => {
      mockDeleteContact.mockResolvedValue(undefined)

      const toursStore = useToursStore()
      const contactsStore = useContactsStore()
      toursStore.tours = [tourWithPartner, tourWithoutPartner]

      await contactsStore.deleteContact('contact-deleted')

      expect(toursStore.tours[0]!.partnerIds).not.toContain('contact-deleted')
      expect(toursStore.tours[0]!.partnerIds).toContain('contact-kept')
      expect(toursStore.tours[1]!.partnerIds).toEqual(['contact-kept'])
    })

    it('should leave tours.value unchanged when deleteContact rejects', async () => {
      mockDeleteContact.mockRejectedValue(new Error('FK violation'))

      const toursStore = useToursStore()
      const contactsStore = useContactsStore()
      toursStore.tours = [tourWithPartner]
      const originalRef = toursStore.tours

      await expect(contactsStore.deleteContact('contact-deleted')).rejects.toThrow('FK violation')

      expect(toursStore.tours).toBe(originalRef)
      expect(toursStore.tours[0]!.partnerIds).toContain('contact-deleted')
    })

    it('should not mutate tours.value when deleted contact is not referenced', async () => {
      mockDeleteContact.mockResolvedValue(undefined)

      const toursStore = useToursStore()
      const contactsStore = useContactsStore()
      toursStore.tours = [tourWithoutPartner]
      const originalRef = toursStore.tours

      await contactsStore.deleteContact('contact-unreferenced')

      expect(toursStore.tours).toBe(originalRef)
    })

    it('should preserve all other tour fields after reconciliation', async () => {
      mockDeleteContact.mockResolvedValue(undefined)

      const toursStore = useToursStore()
      const contactsStore = useContactsStore()
      toursStore.tours = [tourWithPartner]

      await contactsStore.deleteContact('contact-deleted')

      const updated = toursStore.tours[0]!
      expect(updated.name).toBe('Alpine Tour')
      expect(updated.elevation).toBe(1200)
      expect(updated.description).toBe('A great tour')
      expect(updated.id).toBe('tour-a')
    })
  })
})
