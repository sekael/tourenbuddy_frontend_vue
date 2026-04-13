import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapPage from '@/features/map/presentation/pages/map-page.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

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
        TourCreationDialog: { template: '<div />' },
        UserProfileSheet: UserProfileSheetStub,
        ContactsListSheet: { template: '<div />' },
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

      // Pre-populate so the sheet is shown (direct state mutation — actions are stubbed)
      toursStore.$patch({ tours: [STUB_TOUR] })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
    })

    it('should close the feedback sheet on map-background-click', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.showFeedbackSheet = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })

    it('should close the user profile sheet on map-background-click', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.showProfileSheet = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(false)
    })

    it('should close all open sheets at once on map-background-click', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()

      wrapper.vm.showFeedbackSheet = true
      wrapper.vm.showProfileSheet = true
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(false)
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
  })

  describe('dedicated close button', () => {
    it('should call selectTour(null) when the tour info sheet emits close', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()
      const toursStore = useToursStore()

      toursStore.$patch({ tours: [STUB_TOUR] })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="tour-info-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourInfoSheet' }).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
    })

    it('should close the feedback sheet when it emits close', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.showFeedbackSheet = true
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'FeedbackSheet' }).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })

    it('should close the user profile sheet when it emits close', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.showProfileSheet = true
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'UserProfileSheet' }).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(false)
    })
  })
})
