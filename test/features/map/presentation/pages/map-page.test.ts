import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapPage from '@/features/map/presentation/pages/map-page.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

vi.mock('@/features/tours/data/services/swisstopo-elevation-service', () => ({
  getElevation: vi.fn().mockResolvedValue(1234),
}))
vi.mock('@/features/tours/data/services/swisstopo-name-service', () => ({
  suggestTourName: vi.fn().mockResolvedValue('Mocked Peak'),
}))

// Stubs for all heavy child components
const TourenbuddyMapStub = {
  name: 'TourenbuddyMap',
  template: '<div data-testid="map" />',
  emits: ['tourClicked', 'mapBackgroundClick'],
  expose: ['map'],
  setup: () => ({ map: null }),
}
const TourInfoSheetStub = {
  name: 'TourInfoSheet',
  template: '<div data-testid="tour-info-sheet" />',
  emits: ['close'],
  props: ['tour'],
}
const FeedbackSheetStub = {
  name: 'FeedbackSheet',
  template: '<div data-testid="feedback-sheet" />',
  emits: ['close'],
}
const UserProfileSheetStub = {
  name: 'UserProfileSheet',
  template: '<div data-testid="profile-sheet" />',
  emits: ['close'],
}
const ContactsListSheetStub = {
  name: 'ContactsListSheet',
  template: '<div data-testid="contacts-sheet" />',
  emits: ['close'],
}

const TourCreationDialogStub = {
  name: 'TourCreationDialog',
  template: '<div data-testid="tour-creation-dialog" />',
  props: ['initialElevation', 'initialName', 'initialStartPoint', 'initialEndPoint', 'initialGoal'],
  emits: ['confirm', 'close', 'pick-point'],
}

const STUB_TOUR = {
  id: 'tour-1',
  name: 'Test Tour',
  goal: { lat: 46.8, lng: 8.2 },
  plannedDate: null,
  partnerIds: [],
  createdAt: new Date(),
}

function mountMapPage() {
  return mount(MapPage, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })],
      stubs: {
        TourenbuddyMap: TourenbuddyMapStub,
        MapActionOverlay: { template: '<div />' },
        LocationPicker: { template: '<div />' },
        TourInfoSheet: TourInfoSheetStub,
        FeedbackSheet: FeedbackSheetStub,
        TourCreationDialog: TourCreationDialogStub,
        UserProfileSheet: UserProfileSheetStub,
        ContactsListSheet: ContactsListSheetStub,
      },
    },
  })
}

describe('mapPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('map background click dismissal', () => {
    it('should call selectTour(null) to close the tour info sheet on map-background-click', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()
      const toursStore = useToursStore()

      toursStore.$patch({ tours: [STUB_TOUR] })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      wrapper.vm.activeOverlay = 'tour'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
    })

    it('should close the feedback sheet on map-background-click', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })

    it('should close the user profile sheet on map-background-click', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'profile'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(false)
    })

    it('should close the active overlay on map-background-click', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).not.toHaveBeenCalledWith(null)
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })
  })

  describe('tour marker click', () => {
    it('should call selectTour with the clicked tour id', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('tourClicked', 'tour-b')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith('tour-b')
    })

    it('should close the feedback sheet when a tour marker is clicked', async () => {
      const wrapper = mountMapPage()
      const toursStore = useToursStore()
      const mapStore = useMapStore()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)

      toursStore.$patch({ tours: [STUB_TOUR] })
      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('tourClicked', STUB_TOUR.id)
      // Simulate store update (stubbed action doesn't mutate state)
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)
    })
  })

  describe('dedicated close button', () => {
    it('should call selectTour(null) when the tour info sheet emits close', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()
      const toursStore = useToursStore()

      toursStore.$patch({ tours: [STUB_TOUR] })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      wrapper.vm.activeOverlay = 'tour'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourInfoSheet' }).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
    })

    it('should close the feedback sheet when it emits close', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'FeedbackSheet' }).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })

    it('should close the user profile sheet when it emits close', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'profile'
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'UserProfileSheet' }).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(false)
    })
  })

  describe('single active overlay enforcement', () => {
    it('should close contacts sheet when feedback sheet is opened', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'contacts'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="contacts-sheet"]').exists()).toBe(true)

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="contacts-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)
    })

    it('should close feedback sheet when contacts sheet is opened', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)

      wrapper.vm.activeOverlay = 'contacts'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="contacts-sheet"]').exists()).toBe(true)
    })

    it('should clear tour selection when feedback sheet is opened while a tour is selected', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()
      const toursStore = useToursStore()

      toursStore.$patch({ tours: [STUB_TOUR] })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      wrapper.vm.activeOverlay = 'tour'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)

      // openOverlay('feedback') triggers closeOverlay() path for 'tour'
      wrapper.vm.openOverlay('feedback')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)
    })

    it('should not show more than one sheet at a time', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()

      const visibleSheets = [
        wrapper.find('[data-testid="feedback-sheet"]').exists(),
        wrapper.find('[data-testid="profile-sheet"]').exists(),
        wrapper.find('[data-testid="contacts-sheet"]').exists(),
        wrapper.find('[data-testid="tour-info-sheet"]').exists(),
      ].filter(Boolean)

      expect(visibleSheets).toHaveLength(1)
    })
  })

  describe('tour-creation overlay', () => {
    it('should show tour-creation dialog when tour-creation overlay is active', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'tour-creation'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="tour-creation-dialog"]').exists()).toBe(true)
    })

    it('should close feedback when tour-creation overlay is opened', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)

      wrapper.vm.openOverlay('tour-creation')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tour-creation-dialog"]').exists()).toBe(true)
    })

    it('should deselect tour when tour-creation overlay is opened while tour is active', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()
      const toursStore = useToursStore()

      toursStore.$patch({ tours: [STUB_TOUR] })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      wrapper.vm.activeOverlay = 'tour'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)

      wrapper.vm.openOverlay('tour-creation')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tour-creation-dialog"]').exists()).toBe(true)
    })

    it('should close tour-creation when feedback overlay is opened', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'tour-creation'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-creation-dialog"]').exists()).toBe(true)

      wrapper.vm.openOverlay('feedback')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="tour-creation-dialog"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)
    })
  })

  describe('goal change during creation', () => {
    const GOAL = { lng: 8.2, lat: 46.8 }
    // ~100m away from GOAL in LV95
    const NEW_GOAL = { lng: 8.2015, lat: 46.8009 }

    it('same-goal confirm: does not call elevation/name services and keeps existing values', async () => {
      const { getElevation }
        = await import('@/features/tours/data/services/swisstopo-elevation-service')
      const { suggestTourName }
        = await import('@/features/tours/data/services/swisstopo-name-service')
      vi.mocked(getElevation).mockResolvedValue(1234)
      vi.mocked(suggestTourName).mockResolvedValue('Mocked Peak')

      const wrapper = mountMapPage()
      wrapper.vm.activeOverlay = 'tour-creation'
      wrapper.vm.pendingLocation = { ...GOAL }
      wrapper.vm.dialogInitialElevation = 999
      wrapper.vm.dialogInitialName = 'Original'
      wrapper.vm.pendingPickType = 'goal'
      const mapStore = useMapStore()
      mapStore.$patch({ isPickingLocation: true })
      await wrapper.vm.$nextTick()

      await wrapper.vm.handleLocationConfirmed({ ...GOAL })
      await wrapper.vm.$nextTick()

      expect(getElevation).not.toHaveBeenCalled()
      expect(suggestTourName).not.toHaveBeenCalled()
      expect(wrapper.vm.dialogInitialElevation).toBe(999)
      expect(wrapper.vm.dialogInitialName).toBe('Original')
      expect(wrapper.vm.activeOverlay).toBe('tour-creation')
    })

    it('different-goal confirm: calls services and updates pendingLocation/elevation/name', async () => {
      const { getElevation }
        = await import('@/features/tours/data/services/swisstopo-elevation-service')
      const { suggestTourName }
        = await import('@/features/tours/data/services/swisstopo-name-service')
      vi.mocked(getElevation).mockResolvedValue(1234)
      vi.mocked(suggestTourName).mockResolvedValue('Mocked Peak')

      const wrapper = mountMapPage()
      wrapper.vm.activeOverlay = 'tour-creation'
      wrapper.vm.pendingLocation = { ...GOAL }
      wrapper.vm.dialogInitialElevation = 999
      wrapper.vm.dialogInitialName = 'Original'
      wrapper.vm.pendingPickType = 'goal'
      const mapStore = useMapStore()
      mapStore.$patch({ isPickingLocation: true })
      await wrapper.vm.$nextTick()

      await wrapper.vm.handleLocationConfirmed(NEW_GOAL)
      await wrapper.vm.$nextTick()

      expect(getElevation).toHaveBeenCalledWith(NEW_GOAL)
      expect(suggestTourName).toHaveBeenCalledWith(NEW_GOAL)
      expect(wrapper.vm.pendingLocation).toEqual(NEW_GOAL)
      expect(wrapper.vm.dialogInitialElevation).toBe(1234)
      expect(wrapper.vm.dialogInitialName).toBe('Mocked Peak')
      expect(wrapper.vm.activeOverlay).toBe('tour-creation')
    })

    it('re-picking the goal moves the single draft marker to the new location', async () => {
      const wrapper = mountMapPage()
      wrapper.vm.activeOverlay = 'tour-creation'
      wrapper.vm.pendingLocation = { ...GOAL }
      wrapper.vm.pendingPickType = 'goal'
      const mapStore = useMapStore()
      mapStore.$patch({ isPickingLocation: true })
      await wrapper.vm.$nextTick()

      await wrapper.vm.handleLocationConfirmed(NEW_GOAL)
      await wrapper.vm.$nextTick()

      // Single preview-goal setter → inherently one marker that moves, not a second one.
      expect(mapStore.setPreviewGoal).toHaveBeenCalledWith(NEW_GOAL)
    })
  })

  describe('draft marker clear lifecycle', () => {
    const GOAL = { lng: 8.2, lat: 46.8 }
    const DRAFT = { tourType: 'hiking' } as never

    it('clears the draft marker when the creation dialog is cancelled', async () => {
      const wrapper = mountMapPage()
      wrapper.vm.activeOverlay = 'tour-creation'
      wrapper.vm.pendingLocation = { ...GOAL }
      const mapStore = useMapStore()
      await wrapper.vm.$nextTick()

      wrapper.vm.handleDialogClose()
      await wrapper.vm.$nextTick()

      expect(mapStore.setPreviewGoal).toHaveBeenCalledWith(null)
      expect(mapStore.setPreviewTourType).toHaveBeenCalledWith(null)
    })

    it('clears the draft marker even when the create request fails', async () => {
      const wrapper = mountMapPage()
      wrapper.vm.activeOverlay = 'tour-creation'
      wrapper.vm.pendingLocation = { ...GOAL }
      const mapStore = useMapStore()
      const toursStore = useToursStore()
      vi.mocked(toursStore.createTourFromDraft).mockRejectedValue(new Error('create failed'))
      await wrapper.vm.$nextTick()

      // The error still propagates (to Vue's global handler) — finally only guarantees cleanup.
      await expect(wrapper.vm.handleTourCreated(DRAFT, null, false)).rejects.toThrow('create failed')

      // ...but the draft must not be left dangling on the map after a failed save.
      expect(mapStore.setPreviewGoal).toHaveBeenLastCalledWith(null)
      expect(mapStore.setPreviewTourType).toHaveBeenLastCalledWith(null)
    })
  })
})
