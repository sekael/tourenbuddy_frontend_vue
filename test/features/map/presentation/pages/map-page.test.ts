import type { VueWrapper } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { isOnline } from '@/core/offline/use-online-status'
import { fetchSkiRoute } from '@/features/map/data/services/swisstopo-trail-service'
import { ROUTE_ZOOM } from '@/features/map/presentation/composables/frame-tour'
import MapPage from '@/features/map/presentation/pages/map-page.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

vi.mock('@/features/tours/data/services/swisstopo-elevation-service', () => ({
  getElevation: vi.fn().mockResolvedValue(1234),
}))
vi.mock('@/features/map/data/services/swisstopo-trail-service', () => ({
  fetchSkiRoute: vi.fn(),
  SkiRouteNotFoundError: class extends Error {},
}))
vi.mock('@/features/tours/data/services/swisstopo-name-service', () => ({
  suggestTourName: vi.fn().mockResolvedValue('Mocked Peak'),
}))

// No router is installed in the test harness, so mock vue-router to capture the
// back-navigation target (and no-op the route-leave guard).
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push }),
  onBeforeRouteLeave: vi.fn(),
}))

const TAP = { point: { x: 100, y: 100 }, lngLat: { lng: 8.4, lat: 46.8 } }
// Just enough MapLibre for the trail-lookup and tour-framing paths; `zoom` is set per test.
const fakeMap = {
  zoom: 13,
  getZoom: () => fakeMap.zoom,
  getBounds: () => ({ getWest: () => 8, getSouth: () => 46, getEast: () => 9, getNorth: () => 47 }),
  getContainer: () => ({ clientWidth: 400, clientHeight: 800, getBoundingClientRect: () => ({ width: 400, height: 800 }) }),
  project: () => ({ x: 0, y: 0 }),
  // One rendered ski route piece at screen (0, 0): a tap box containing it hits, others miss.
  getLayer: () => ({}),
  getSource: () => ({ tiles: ['https://data.test/ski-routes/v1/{z}/{x}/{y}.pbf'], setUrl: vi.fn() }),
  queryRenderedFeatures: ([[x0, y0], [x1, y1]]: [number, number][]) => x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0
    ? [{ properties: { id: 'r1' }, geometry: { type: 'LineString', coordinates: [[8.4, 46.8], [8.41, 46.81]] } }]
    : [],
  getBearing: () => 0,
  cameraForBounds: () => undefined,
  flyTo: vi.fn(),
  on: vi.fn(),
}

// Stubs for all heavy child components
const TourenbuddyMapStub = {
  name: 'TourenbuddyMap',
  template: '<div data-testid="map" />',
  emits: ['tourClicked', 'mapBackgroundClick'],
  expose: ['map'],
  setup: () => ({ map: fakeMap }),
}
const TourInfoSheetStub = {
  name: 'TourInfoSheet',
  template: '<div data-testid="tour-info-sheet" />',
  emits: ['close', 'back'],
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

// Speed-dial controls the page drives (e.g. the guided tour's staging).
const overlayMenu = { openMenu: vi.fn(), closeMenu: vi.fn(), openMapLayers: vi.fn() }

/** `<script setup>` state the tests drive directly; the page exposes none of it publicly. */
interface MapPageInternals {
  activeOverlay: string | null
  pendingLocation: { lng: number, lat: number } | null
  pendingPickType: 'goal' | 'start' | 'end'
  dialogInitialName: string | null
  dialogInitialElevation: number | null
  tourDetailOrigin: 'list' | 'cal-seasons' | 'cal-planned' | null
  tourDetailOriginDay: string | null
  showCalendarFeatureNotice: boolean
  onboardingTour: { startTour: (step: number) => void, finish: () => void }
  openOverlay: (name: string) => void
  handleLocationConfirmed: (location: { lng: number, lat: number }) => Promise<void>
  handleTourCreated: (...args: unknown[]) => Promise<void>
  handleDialogClose: () => void
  dismissCalendarFeatureNotice: () => void
}

function mountMapPage(
  initialState = {},
  stubOverrides: Record<string, unknown> = {},
): VueWrapper<ComponentPublicInstance & MapPageInternals> {
  return mount(MapPage, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true, initialState })],
      stubs: {
        TourenbuddyMap: TourenbuddyMapStub,
        MapActionOverlay: {
          template: '<div />',
          expose: ['openMenu', 'closeMenu', 'openMapLayers'],
          setup: () => overlayMenu,
        },
        LocationPicker: { template: '<div />' },
        TourInfoSheet: TourInfoSheetStub,
        FeedbackSheet: FeedbackSheetStub,
        TourCreationDialog: TourCreationDialogStub,
        UserProfileSheet: UserProfileSheetStub,
        ContactsListSheet: ContactsListSheetStub,
        ...stubOverrides,
      },
    },
  }) as unknown as VueWrapper<ComponentPublicInstance & MapPageInternals>
}

describe('mapPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
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

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', TAP)
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).toHaveBeenCalledWith(null)
    })

    it('should close the feedback sheet on map-background-click', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', TAP)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })

    it('should close the user profile sheet on map-background-click', async () => {
      const wrapper = mountMapPage()

      wrapper.vm.activeOverlay = 'profile'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(true)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', TAP)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="profile-sheet"]').exists()).toBe(false)
    })

    it('should close the active overlay on map-background-click', async () => {
      const wrapper = mountMapPage()
      const mapStore = useMapStore()

      wrapper.vm.activeOverlay = 'feedback'
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', TAP)
      await wrapper.vm.$nextTick()

      expect(mapStore.selectTour).not.toHaveBeenCalledWith(null)
      expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false)
    })
  })

  describe('ski route taps', () => {
    const skiOn = { map: { activeOverlays: ['ski'] } }
    const route = { name: null, targetName: 'Peak', targetAltitude: null, difficulty: null, ascentTime: null, ascentM: null, descentM: null, sacUrl: null }
    // fakeMap.project puts every vertex at (0, 0): a tap there hits, one far away misses.
    const trail = { overlay: 'ski', id: 'r1', lines: [[[8.4, 46.8], [8.41, 46.81]]], route }

    beforeEach(() => {
      fakeMap.zoom = 13
      isOnline.value = true
      vi.mocked(fetchSkiRoute).mockReset().mockResolvedValue(trail as never)
    })

    const tapAt = (x: number) => ({ ...TAP, point: { x, y: x } })

    it('should treat a tap below the marking zoom as a plain map tap, without lookup or message', async () => {
      fakeMap.zoom = 10.5
      const wrapper = mountMapPage(skiOn)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', tapAt(0))
      await flushPromises()

      expect(fetchSkiRoute).not.toHaveBeenCalled()
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
      expect(wrapper.vm.activeOverlay).toBeNull()
    })

    it('should explain an offline tap on a marked route instead of loading it', async () => {
      isOnline.value = false
      const wrapper = mountMapPage(skiOn)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', tapAt(0))
      await flushPromises()

      expect(fetchSkiRoute).not.toHaveBeenCalled()
      expect(wrapper.find('[role="status"]').text()).toBe('map.trail.offline')
    })

    it('should stay silent on an offline tap beside the routes', async () => {
      isOnline.value = false
      const wrapper = mountMapPage(skiOn)

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', tapAt(300))
      await flushPromises()

      expect(wrapper.find('[role="status"]').exists()).toBe(false)
    })

    it('should only close a tour sheet, without a lookup', async () => {
      const wrapper = mountMapPage(skiOn)
      wrapper.vm.activeOverlay = 'feedback'
      await flushPromises()

      await wrapper.findComponent({ name: 'TourenbuddyMap' }).vm.$emit('mapBackgroundClick', tapAt(0))
      await flushPromises()

      expect(fetchSkiRoute).not.toHaveBeenCalled()
      expect(wrapper.vm.activeOverlay).toBeNull()
    })

    it('should close an open trail card when the next tap misses', async () => {
      const wrapper = mountMapPage(skiOn, { TrailCard: { template: '<div data-testid="trail-card" />' } })
      const map = wrapper.findComponent({ name: 'TourenbuddyMap' })

      await map.vm.$emit('mapBackgroundClick', tapAt(0))
      await flushPromises()
      expect(wrapper.vm.activeOverlay).toBe('trail-info')

      await map.vm.$emit('mapBackgroundClick', tapAt(300))
      await flushPromises()
      expect(wrapper.vm.activeOverlay).toBeNull()
    })

    describe('framing a route chosen from the list', () => {
      const other = { ...trail, id: 'r2', lines: [[[8.5, 46.9], [8.51, 46.91]]] }
      const settle = () => new Promise(resolve => setTimeout(resolve, 50))

      // Every vertex projects left of the drawer, so the whole highlight counts as visible.
      async function listShown() {
        vi.spyOn(fakeMap, 'project').mockReturnValue({ x: 200, y: 300 })
        vi.spyOn(fakeMap, 'getContainer').mockReturnValue({ clientWidth: 1200, clientHeight: 800, getBoundingClientRect: () => ({ width: 1200, height: 800 }) })
        mountMapPage(skiOn, { TrailCard: { template: '<div />' } })
        const mapStore = useMapStore()
        mapStore.trailCard = { candidates: [trail, other], more: 0, selectedId: null } as never
        await settle()
        fakeMap.flyTo.mockClear()
        return mapStore
      }

      it('should fly to the chosen route even when it is already fully visible', async () => {
        const mapStore = await listShown()

        mapStore.trailCard = { ...mapStore.trailCard!, selectedId: 'r2' }
        await settle()

        expect(fakeMap.flyTo).toHaveBeenCalledWith(expect.objectContaining({
          center: expect.objectContaining({ lng: expect.closeTo(8.505), lat: expect.closeTo(46.905) }),
          zoom: ROUTE_ZOOM,
        }))
      })

      it('should not move the camera when going back to a visible list', async () => {
        const mapStore = await listShown()
        mapStore.trailCard = { ...mapStore.trailCard!, selectedId: 'r2' }
        await settle()
        fakeMap.flyTo.mockClear()

        mapStore.trailCard = { ...mapStore.trailCard!, selectedId: null }
        await settle()

        expect(fakeMap.flyTo).not.toHaveBeenCalled()
      })
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

  describe('calendar feature notice', () => {
    it('shows the one-time notice and dismisses only the notice gate', async () => {
      const wrapper = mountMapPage({
        userProfile: {
          profile: {
            id: 'user-123',
            firstName: 'Max',
            lastName: 'Muster',
            locale: 'en',
            onboardingTourShowAtSignIn: false,
            onboardingTourLastStep: 0,
            calendarTourShowOnFirstOpen: true,
            calendarFeatureNoticeShowAtSignIn: true,
          },
        },
      })
      const userProfileStore = useUserProfileStore()

      expect(wrapper.vm.showCalendarFeatureNotice).toBe(true)

      wrapper.vm.dismissCalendarFeatureNotice()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showCalendarFeatureNotice).toBe(false)
      expect(userProfileStore.dismissCalendarFeatureNotice).toHaveBeenCalledTimes(1)
      expect(userProfileStore.dismissCalendarTour).not.toHaveBeenCalled()
    })
  })

  describe('guided tour quit early', () => {
    it('should return to the overlay the tour was started from, without the menu', async () => {
      const wrapper = mountMapPage()
      wrapper.vm.activeOverlay = 'profile'
      await wrapper.vm.$nextTick()

      wrapper.vm.onboardingTour.startTour(0)
      wrapper.vm.onboardingTour.finish()
      await new Promise(r => setTimeout(r, 50))

      expect(wrapper.vm.activeOverlay).toBe('profile')
      expect(overlayMenu.openMenu).not.toHaveBeenCalled()
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

  describe('calendar-originated back navigation', () => {
    // Open a planned-view tour, then emit the info sheet's back event.
    async function openPlannedTourThenBack(
      plannedDate: Date | null,
      opts: { endDate?: Date | null, originDay?: string } = {},
    ) {
      const wrapper = mountMapPage()
      const toursStore = useToursStore()
      const mapStore = useMapStore()

      toursStore.$patch({
        tours: [{ ...STUB_TOUR, plannedDate, endDate: opts.endDate ?? null }],
      })
      mapStore.$patch({ selectedTourId: STUB_TOUR.id })
      wrapper.vm.tourDetailOriginDay = opts.originDay ?? null
      wrapper.vm.tourDetailOrigin = 'cal-planned'
      wrapper.vm.activeOverlay = 'tour'
      await wrapper.vm.$nextTick()

      push.mockClear()
      await wrapper.findComponent({ name: 'TourInfoSheet' }).vm.$emit('back')
      await wrapper.vm.$nextTick()
      return push
    }

    it('returns to the tour\'s CURRENT planned day, not the day it was opened from', async () => {
      // The date was edited to 2026-08-20 in the detail; back must open that day.
      const back = await openPlannedTourThenBack(new Date(2026, 7, 20))
      expect(back).toHaveBeenCalledWith({
        name: 'calendar',
        query: { view: 'planned', day: '2026-08-20' },
      })
    })

    it('omits the day param when the tour was unplanned in the detail', async () => {
      const back = await openPlannedTourThenBack(null)
      expect(back).toHaveBeenCalledWith({
        name: 'calendar',
        query: { view: 'planned' },
      })
    })

    it('returns to the day a span was opened from, not the span\'s first day', async () => {
      const back = await openPlannedTourThenBack(new Date(2026, 7, 25), {
        endDate: new Date(2026, 7, 27),
        originDay: '2026-08-27',
      })
      expect(back).toHaveBeenCalledWith({
        name: 'calendar',
        query: { view: 'planned', day: '2026-08-27' },
      })
    })

    it('falls back to the start day when an edit shortened the span past the origin day', async () => {
      // Opened from day 3, then the span was cut to a single day in the detail.
      const back = await openPlannedTourThenBack(new Date(2026, 7, 25), {
        endDate: null,
        originDay: '2026-08-27',
      })
      expect(back).toHaveBeenCalledWith({
        name: 'calendar',
        query: { view: 'planned', day: '2026-08-25' },
      })
    })
  })

  describe('speed dial blocks the action bar', () => {
    // `defineExpose` unwraps refs for the parent, so the exposed `isOpen` is a plain
    // boolean. Reading `.value` off it yielded `undefined`, so an open speed dial never
    // put the bar into dismiss mode and its buttons acted instead of closing the dial.
    it('should put the action bar in dismiss mode while the speed dial is open', async () => {
      const wrapper = mountMapPage(
        {},
        {
          MapActionOverlay: {
            name: 'MapActionOverlay',
            template: '<div />',
            expose: ['isOpen'],
            setup: () => ({ isOpen: ref(true) }),
          },
        },
      )

      // The template ref lands after the first render, so the bar picks it up next tick.
      await nextTick()

      const bar = wrapper.findComponent({ name: 'TourActionBar' })
      expect(bar.props('dismissMode')).toBe(true)
      expect(bar.props('toursDisabled')).toBe(true)
    })
  })
})
