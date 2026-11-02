<script setup lang="ts">
import type { Map as MapLibreMap, Point } from 'maplibre-gl'
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat, Trail } from '@/features/map/domain/entities/trail'
import type { RoutePoints, RouteStep } from '@/features/map/domain/route-plan'
import type { DraftStage } from '@/features/map/presentation/stores/map-store'
import type { StageContext } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import type { TourSurface } from '@/features/onboarding/presentation/onboarding-steps'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import type { CreationStage, StagePayload } from '@/features/tours/presentation/composables/creation-stages'
import type { PointChange, PointPick } from '@/features/tours/presentation/composables/use-swisstopo-fill'
import { LngLatBounds } from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import FeedbackSheet from '@/core/components/feedback-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useScrollLock } from '@/core/composables/use-scroll-lock'
import { sheetInset } from '@/core/composables/use-sheet-inset'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { isOnline } from '@/core/offline/use-online-status'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { spanDayKeys } from '@/features/calendar/domain/calendar-dates'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import FriendRequestsSheet from '@/features/friendships/presentation/components/friend-requests-sheet.vue'
import { ROUTE_STEPS } from '@/features/map/domain/route-plan'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'
import MapActionOverlay from '@/features/map/presentation/components/map-action-overlay.vue'
import OfflineDownloadSheet from '@/features/map/presentation/components/offline-download-sheet.vue'
import OfflineManageSheet from '@/features/map/presentation/components/offline-manage-sheet.vue'
import OfflineRegionDraw from '@/features/map/presentation/components/offline-region-draw.vue'
import OfflineRegionOutline from '@/features/map/presentation/components/offline-region-outline.vue'
import RoutePlanner from '@/features/map/presentation/components/route-planner.vue'
import TourActionBar from '@/features/map/presentation/components/tour-action-bar.vue'
import TourenbuddyMap from '@/features/map/presentation/components/tourenbuddy-map.vue'
import TrackDrawer from '@/features/map/presentation/components/track-drawer.vue'
import TrailCard from '@/features/map/presentation/components/trail-card.vue'
import { TRAIL_LOOKUP_MIN_ZOOM } from '@/features/map/presentation/components/trail-layers'
import { computeBarState } from '@/features/map/presentation/composables/compute-bar-state'
import { frameBounds, frameTours, isBoundsVisible, ROUTE_ZOOM } from '@/features/map/presentation/composables/frame-tour'
import { planFromRoute } from '@/features/map/presentation/composables/plan-from-route'
import { useInboxNavigation } from '@/features/map/presentation/composables/use-inbox-navigation'
import { useTrailLookup } from '@/features/map/presentation/composables/use-trail-lookup'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import InboxOverlay from '@/features/notifications/presentation/components/inbox-overlay.vue'
import { useInboxStore } from '@/features/notifications/presentation/stores/inbox-store'
import { useNotificationsStore } from '@/features/notifications/presentation/stores/notifications-store'
import OnboardingTourBanner from '@/features/onboarding/presentation/components/onboarding-tour-banner.vue'
import OnboardingWelcome from '@/features/onboarding/presentation/components/onboarding-welcome.vue'
import { useOnboardingTour } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import { ONBOARDING_STEPS } from '@/features/onboarding/presentation/onboarding-steps'
import { useOnboardingTourStore } from '@/features/onboarding/presentation/stores/onboarding-tour-store'
import { isSameGoal } from '@/features/tours/domain/distance'
import { nextSegmentSeed, outingKey, outingSegments, spanDays } from '@/features/tours/domain/outing'
import OutingOverviewSheet from '@/features/tours/presentation/components/outing-overview-sheet.vue'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'
import TourListSheet from '@/features/tours/presentation/components/tour-list-sheet.vue'
import { resetTourFilters, showFriendTours, useListedTourIds } from '@/features/tours/presentation/composables/use-tour-filters'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import UserProfileSheet from '@/features/user/presentation/components/user-profile-sheet.vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

type PickPointType = PointPick['type']
type OverlayName
  = | 'feedback'
    | 'profile'
    | 'contacts'
    | 'tours'
    | 'tour'
    | 'outing'
    | 'tour-creation'
    | 'friend-requests'
    | 'inbox'
    | 'offline-manage'
    | 'offline-download'
    | 'trail-info'

const { t, locale } = useI18n({ useScope: 'global' })
const router = useRouter()

const mapStore = useMapStore()
const toursStore = useToursStore()
const tourSuggestionsStore = useTourSuggestionsStore()
const attachmentsStore = useTourAttachmentsStore()
const contactsStore = useContactsStore()
const userProfileStore = useUserProfileStore()
const authStore = useAuthStore()
const onboardingTourStore = useOnboardingTourStore()
const notificationsStore = useNotificationsStore()
const inboxStore = useInboxStore()
const isDesktop = useIsDesktop()

const { isPickingLocation, isDrawingTrack, isDrawingRegion, selectedTourId, selectedOutingKey, activeOverlays, trailCard, previewTourTypes } = storeToRefs(mapStore)
/** The picker reports a touch-screen search; read only while picking, so a stale value never hides a sheet. */
const pickerSearching = ref(false)
// The collapsed overlay ("Tour goal") then only takes room from the keyboard and results. On
// phones it is teleported to <body>, so the switch lives on <html> (like `scroll-locked`).
watch(() => isPickingLocation.value && pickerSearching.value, on => document.documentElement.classList.toggle('picker-searching', on))
onUnmounted(() => document.documentElement.classList.remove('picker-searching'))
const { tours, friendTours } = storeToRefs(toursStore)
const { isAuthenticated } = storeToRefs(authStore)
const { reopenSignal } = storeToRefs(onboardingTourStore)

const mapRef = ref<InstanceType<typeof TourenbuddyMap> | null>(null)
const creationRef = ref<InstanceType<typeof TourCreationDialog> | null>(null)
const mapOverlayRef = ref<InstanceType<typeof MapActionOverlay> | null>(null)
const mapBearing = ref(0)

// `defineExpose` widens the exposed `shallowRef<Map>` structurally, which drops the
// class identity MapLibre's `Map` relies on. Re-assert it once here rather than at
// every child that takes a `:map` prop.
const mapInstance = computed<MapLibreMap | null>(
  () => (mapRef.value?.map ?? null) as MapLibreMap | null,
)

// Single source of truth for which overlay is open (at most one at a time)
const activeOverlay = ref<OverlayName | null>(null)

// Bounding box confirmed for an offline-map download (drawn region or whole map).
const offlineBbox = ref<[number, number, number, number] | null>(null)

// The crosshair pick of a saved tour's edit: which point ('goal', 'start' or 'end').
const pendingPickType = ref<'goal' | 'start' | 'end'>('goal')

// Computed visibility flags for template readability
const showFeedbackSheet = computed(() => activeOverlay.value === 'feedback')
const showProfileSheet = computed(() => activeOverlay.value === 'profile')
const showContactDialog = computed(() => activeOverlay.value === 'contacts')
const showToursList = computed(() => activeOverlay.value === 'tours')
// ── Tour creation (map-first-tour-creation) ─────────────────────────────────
/** The stages being created, one form each (D4); empty while none is. */
const stages = ref<CreationStage[]>([])
const activeStage = ref(0)
/** What a stage's form shows the map (D7). */
interface StageLive {
  tourTypes?: TourType[]
  start?: { lng: number, lat: number } | null
  end?: { lng: number, lat: number } | null
  track?: LngLat[] | null
}
const stageLive = ref<Record<string, StageLive>>({})
/** The outing a new stage joins: a segment added to a tour, or a saved tour split into days. */
const segmentAnchorId = ref<string | null>(null)
/** The anchor is a split tour: it keeps its first day on save (D5). */
const splitAnchor = ref(false)
/** Day numbers continue after the anchor's outing; `dayCount` is the span a split laid out. */
const dayOffset = ref(0)
const dayCount = ref<number | null>(null)
/** The route step (D1): which stage it plans (`stages.length` = a new one), from what. */
interface PlannerState {
  initial: RoutePoints
  step: RouteStep
  stage: number
  /** A new stage's form seed (the next day's, an added segment's). */
  seed: TourDraft | null
}
const planner = ref<PlannerState | null>(null)
/** Bumped per opening, so each one starts fresh. */
const plannerRun = ref(0)
const plannerPoints = ref<RoutePoints | null>(null)
const NO_ROUTE: RoutePoints = { start: null, goal: null, end: null }
/** The route step left for a ski route's card, to come back to when the card closes. */
const pausedPlanner = ref<PlannerState | null>(null)

const showTourCreationDialog = computed(() => activeOverlay.value === 'tour-creation' && stages.value.length > 0)
const showFriendRequests = computed(() => activeOverlay.value === 'friend-requests')

// One sheet replacing another (e.g. tour list → tour) uses `sheet-swap`, a quick
// lift-and-fade, instead of sliding fully off-screen and back up; opening from and
// closing to the bare map keep the full `sheet` slide. Sync flush so the name is
// already set when the <Transition> starts the leave.
// ponytail: keyed on activeOverlay, not the exact v-if chain — an edge-case mismatch
// only picks the other animation, never breaks rendering.
const sheetTransition = ref<'sheet' | 'sheet-swap'>('sheet')
watch(activeOverlay, (next, prev) => {
  sheetTransition.value = next !== null && prev !== null ? 'sheet-swap' : 'sheet'
}, { flush: 'sync' })

const barState = computed(() =>
  computeBarState({
    activeOverlay: activeOverlay.value,
    isPickingLocation: isPickingLocation.value,
    // `defineExpose` unwraps refs for the parent, so this is already a boolean.
    // The old `?.value` read `undefined` off it — the speed dial never counted as open.
    speedDialOpen: mapOverlayRef.value?.isOpen ?? false,
    isAuthenticated: isAuthenticated.value,
  }),
)

const addTourTooltip = computed(() =>
  isAuthenticated.value ? undefined : t('map.overlay.signInToAddToursTooltip'),
)

// Track drawing (#323): the form's current track to go on from, and the finished drawing for the
// edit form (the creation form's goes onto its stage, a planned ski route's line too, #352).
const trackSeed = ref<DrawnTrack | null>(null)
const editDrawnTrack = ref<DrawnTrack | null>(null)

// Derived reactively from store so it updates immediately when tours are mutated.
// Search friend tours too — a friend marker (partner tours) can be selected on the map.
const selectedTour = computed(
  () =>
    tours.value.find(t => t.id === selectedTourId.value)
    ?? friendTours.value.find(t => t.id === selectedTourId.value)
    ?? null,
)
const sheetContainerRef = ref<HTMLElement | null>(null)

// ── Outings (#338, design D15) ───────────────────────────────────────────────
const allTours = computed(() => [...tours.value, ...friendTours.value])
/** Segments of the outing whose overview is open (empty once it dissolves). */
const selectedOutingSegments = computed(() => outingSegments(allTours.value, selectedOutingKey.value))
/** Where the open overview was entered from — `list` offers a back to the tour list. */
const outingOrigin = ref<'list' | null>(null)

// Whether the current location pick was triggered from the info sheet edit mode
const isPickingForEdit = ref(false)

// Set when flyToSelectedTour is called before sheetContainerRef has mounted
const pendingFlyTo = ref(false)

// Where the currently-open tour detail was entered from — drives the info
// sheet's back button target. `list` returns to the tours overlay; `cal-*`
// returns to the calendar route on the matching view; `null` = no back offered.
const tourDetailOrigin = ref<'list' | 'outing' | 'cal-seasons' | 'cal-planned' | null>(null)
// `cal-planned` only: the day cell the detail was opened from (a span covers several).
const tourDetailOriginDay = ref<string | null>(null)

// Contact id to auto-open in the contacts sheet (from tour chip edit-contact action)
const editContactId = ref<string | null>(null)

// Prop-based handoff to info sheet after a location pick in edit mode
const editPickedPoint = ref<PointPick | null>(null)

function resetTourCreationState() {
  stages.value = []
  activeStage.value = 0
  stageLive.value = {}
  segmentAnchorId.value = null
  splitAnchor.value = false
  dayOffset.value = 0
  dayCount.value = null
  pausedPlanner.value = null
  if (planner.value)
    closePlanner()
  // Drop the draft markers on every cancel/dismiss path (closeOverlay, openOverlay
  // switching away). The save path holds them through the round-trip (`heldPreview`).
  mapStore.setPreviewGoal(null)
  mapStore.setPreviewTourTypes(null)
  mapStore.setPreviewStart(null)
  mapStore.setPreviewEnd(null)
  mapStore.setPreviewTrack(null)
}

/** Opens an overlay, closing any previously open overlay first. */
function openOverlay(name: OverlayName) {
  if (activeOverlay.value === name)
    return
  if (activeOverlay.value === 'tour' && name !== 'tour') {
    mapStore.selectTour(null)
    clearTourPreview()
    tourDetailOrigin.value = null
    tourDetailOriginDay.value = null
  }
  // Overview → segment keeps the outing's origin for the way back.
  if (activeOverlay.value === 'outing' && name !== 'outing' && name !== 'tour') {
    mapStore.selectOuting(null)
    outingOrigin.value = null
  }
  if (activeOverlay.value === 'tour-creation' && name !== 'tour-creation') {
    resetTourCreationState()
  }
  activeOverlay.value = name
}

/** Closes the currently open overlay, cleaning up state if needed. */
function closeOverlay() {
  if (activeOverlay.value === 'tour') {
    mapStore.selectTour(null)
    clearTourPreview()
    tourDetailOrigin.value = null
    tourDetailOriginDay.value = null
    outingOrigin.value = null
  }
  if (activeOverlay.value === 'outing') {
    mapStore.selectOuting(null)
    outingOrigin.value = null
  }
  if (activeOverlay.value === 'tour-creation') {
    resetTourCreationState()
  }
  activeOverlay.value = null
}

// --- Onboarding tour ---------------------------------------------------------
// The tour composable knows only abstract surfaces; this page owns the concrete
// overlays + speed-dial, so it translates each surface into open/close calls.
// `from` is the surface already on screen: the path starts from there when it
// can (menu still open, contacts already showing) and from a clean slate
// otherwise. Each waypoint carries a short hint ("Open menu", "Open contacts")
// via `ctx.spotlight(selector, hintKey)`, which waits for the control to settle.
async function stageTourSurface(surface: TourSurface, ctx: StageContext, from: TourSurface | null) {
  // The speed-dial menu, open with nothing expanded. Reuses an open menu
  // (folding the map layers panel back in) instead of replaying the FAB.
  async function showMenu() {
    if (from === 'menu' || from === 'map-layers-panel') {
      mapOverlayRef.value?.openMenu()
      return
    }
    closeOverlay()
    mapOverlayRef.value?.closeMenu()
    await ctx.spotlight('[data-tour="open-menu"]', 'onboarding.tour.nav.openMenu')
    mapOverlayRef.value?.openMenu()
  }
  // Open a speed-dial-backed sheet the way a user would: menu → item → sheet.
  async function openViaMenu(name: OverlayName, itemSelector: string, itemHintKey: string) {
    await showMenu()
    await ctx.spotlight(itemSelector, itemHintKey)
    mapOverlayRef.value?.closeMenu()
    openOverlay(name)
  }

  switch (surface) {
    case 'profile': {
      // The Notifications / Calendar sync rows' summaries come from fetches.
      // Load them BEFORE the highlight so the spotlighted rows are complete;
      // the fetch overlaps the waypoint spotlights, so the wait is normally free.
      const prefsReady = notificationsStore.prefs ? null : notificationsStore.loadPrefs()
      await openViaMenu('profile', '[data-tour="menu-profile"]', 'onboarding.tour.nav.profile')
      await prefsReady
      break
    }
    case 'contacts':
      await openViaMenu('contacts', '[data-tour="menu-contacts"]', 'onboarding.tour.nav.contacts')
      break
    case 'friend-requests':
      // Reached through the contacts sheet — already open when coming from it.
      if (from !== 'contacts')
        await openViaMenu('contacts', '[data-tour="menu-contacts"]', 'onboarding.tour.nav.contacts')
      await ctx.spotlight('[data-tour="open-friend-requests"]', 'onboarding.tour.nav.friendRequests')
      openOverlay('friend-requests')
      break
    case 'tours':
      // The My-tours sheet opens from the bottom action bar, not the speed-dial.
      closeOverlay()
      mapOverlayRef.value?.closeMenu()
      await ctx.spotlight('[data-tour="open-tours"]', 'onboarding.tour.nav.tours')
      openOverlay('tours')
      break
    case 'tour-bar':
      // No overlay — the bottom action bar (add-tour button) is always visible.
      closeOverlay()
      mapOverlayRef.value?.closeMenu()
      break
    case 'menu':
      await showMenu()
      break
    case 'map-layers-panel':
      await showMenu()
      await ctx.spotlight('[data-tour="menu-map-layers"]', 'onboarding.tour.nav.mapLayers')
      mapOverlayRef.value?.openMapLayers()
      break
  }
  await nextTick()
}

// The overlay open when the tour started; staging closes it, an early quit
// reopens it. Only overlays that need no extra state (a selected tour, a drawn
// region, a creation draft) can be reopened as they were.
const RESTORABLE_ORIGINS = new Set<OverlayName>(['feedback', 'profile', 'contacts', 'friend-requests', 'inbox', 'tours', 'offline-manage'])
let tourOrigin: OverlayName | null = null

const onboardingTour = useOnboardingTour({
  steps: ONBOARDING_STEPS,
  stage: stageTourSurface,
  cleanup: () => {
    closeOverlay()
    mapOverlayRef.value?.closeMenu()
  },
  // Quit early: back to where the tour was started from (e.g. the profile sheet
  // for "Show app tour"), not a bare map.
  onDismissed: () => {
    if (tourOrigin && RESTORABLE_ORIGINS.has(tourOrigin))
      openOverlay(tourOrigin)
    tourOrigin = null
  },
  // Ran to completion (not an early dismissal): hand off to the calendar route.
  // The calendar's own gate decides whether the calendar tour actually starts.
  onCompleted: () => {
    mapStore.setPendingIntent({ startCalendarTour: true })
    router.push({ name: 'calendar' })
  },
  saveTourStep: n => userProfileStore.saveTourStep(n),
  dismissTourAtSignIn: () => userProfileStore.dismissTourAtSignIn(),
  canAutoStart: () =>
    isAuthenticated.value
    && userProfileStore.profile != null
    && userProfileStore.profile.onboardingTourShowAtSignIn === true,
  getResumeStep: () => userProfileStore.profile?.onboardingTourLastStep ?? 0,
})

// Reactive tour state for the top banner.
const {
  isRunning: tourRunning,
  isStaging: tourStaging,
  currentIndex: tourIndex,
  currentTitle: tourTitle,
  showWelcome: tourWelcome,
} = onboardingTour

// Sync: captured as the tour starts, before its first stage closes the overlay.
watch(tourRunning, (running) => {
  if (running)
    tourOrigin = activeOverlay.value
}, { flush: 'sync' })
const tourTotal = onboardingTour.totalSteps
const showCalendarFeatureNotice = ref(false)

function maybeShowCalendarFeatureNotice() {
  if (
    !tourRunning.value
    && !tourWelcome.value
    && userProfileStore.profile?.calendarFeatureNoticeShowAtSignIn === true
  ) {
    showCalendarFeatureNotice.value = true
  }
}

function dismissCalendarFeatureNotice() {
  showCalendarFeatureNotice.value = false
  userProfileStore.dismissCalendarFeatureNotice()
}

// The router guard blocks /map until the profile is loaded, so the auto-start
// gate is already decidable in setup — open the welcome synchronously, before
// the first paint, so a tour-eligible user never sees the bare map flash first.
// (No-op when the gate is off; `onMounted` re-checks for a cold profile.)
onboardingTour.maybeStartTour()
maybeShowCalendarFeatureNotice()

// The map route never scrolls the document, for its whole lifetime — not just
// while the tour runs. `.map-page` is fixed + overflow:hidden, but that pins the
// PAGE, not the document: `#app { min-height: 100lvh }` leaves a scrollable
// overflow whenever browser chrome is shown, and a gesture anywhere off the map
// canvas rubber-bands it. The canvas then slides while MapLibre's camera does
// not, so the picker unprojects a canvas that moved out from under the crosshair
// (#247). This also covers the tour, which is why no tour-scoped lock remains.
useScrollLock()

// driver.js' overlay lives on <body> outside Vue, so a route change (back
// button / back-swipe) would leave it orphaned on a non-tour page. Tear it down
// before leaving and on any unmount.
onBeforeRouteLeave(() => {
  onboardingTour.stop()
})
onUnmounted(() => {
  onboardingTour.stop()
})

// "Show app tour" in the profile sheet bumps this signal — resume at last step.
watch(reopenSignal, () => {
  onboardingTour.startTour(userProfileStore.profile?.onboardingTourLastStep ?? 0)
  // The profile sheet closes itself before signalling, so the start-time capture
  // above saw no overlay — an early quit must still return to the profile.
  tourOrigin = 'profile'
})

function handleTourSelectedFromList(tourId: string) {
  tourDetailOrigin.value = 'list'
  tourDetailOriginDay.value = null
  mapStore.selectTour(tourId)
  openOverlay('tour')
}

function handleTourInfoBack() {
  // A segment opened from its outing's overview goes back there.
  const key = selectedTour.value && outingKey(selectedTour.value)
  if (tourDetailOrigin.value === 'outing' && key) {
    openOuting(key, outingOrigin.value)
    return
  }
  const origin = tourDetailOrigin.value
  // Return to the day the detail was opened from — for a multi-day tour that is not its
  // start day. Validated against the tour's LIVE span (read before we clear the
  // selection): the dates may have been edited in the detail, and an edit that moves the
  // span out from under the stored day must not return the user to a day the tour no
  // longer covers. Fall back to the start day then.
  const plannedDate = selectedTour.value?.plannedDate
  const stored = tourDetailOriginDay.value
  const spanKeys = plannedDate ? spanDayKeys(plannedDate, selectedTour.value?.endDate ?? null) : []
  const originDay = stored && spanKeys.includes(stored) ? stored : (spanKeys[0] ?? null)
  tourDetailOriginDay.value = null
  tourDetailOrigin.value = null
  mapStore.selectTour(null)
  clearTourPreview()
  // Calendar-originated detail returns to the calendar on its originating view;
  // list-originated returns to the tours overlay (today's behavior). For a planned
  // selection, carry the dayKey so the calendar re-opens that day's detail list.
  if (origin === 'cal-seasons' || origin === 'cal-planned') {
    router.push({
      name: 'calendar',
      query: {
        view: origin === 'cal-seasons' ? 'seasons' : 'planned',
        ...(origin === 'cal-planned' && originDay ? { day: originDay } : {}),
      },
    })
    return
  }
  activeOverlay.value = 'tours'
}

function openOuting(key: string, origin: 'list' | null) {
  clearTourPreview()
  tourDetailOrigin.value = null
  tourDetailOriginDay.value = null
  outingOrigin.value = origin
  // The selectedOutingKey watch swaps the sheet in.
  mapStore.selectOuting(key)
}

/** The navigator's outing link: the overview inherits the list origin the segment had. */
function handleInfoSheetOpenOuting(key: string) {
  const fromList = tourDetailOrigin.value === 'list' || (tourDetailOrigin.value === 'outing' && outingOrigin.value === 'list')
  openOuting(key, fromList ? 'list' : null)
}

function handleOpenSegment(tourId: string) {
  tourDetailOrigin.value = 'outing'
  tourDetailOriginDay.value = null
  mapStore.selectTour(tourId)
}

function handleOutingBack() {
  mapStore.selectOuting(null)
  outingOrigin.value = null
  activeOverlay.value = 'tours'
}

/**
 * "New segment on the map" (D17): the route step for its goal, starting where the outing's last
 * segment (or the standalone anchor) finishes, with the form seeded from it. The outing itself is
 * minted on save.
 */
function handleAddSegment(anchorId: string) {
  const anchor = tours.value.find(t => t.id === anchorId)
  if (!anchor)
    return
  const segments = outingSegments(tours.value, outingKey(anchor))
  const prev = segments.at(-1) ?? anchor
  closeOverlay()
  segmentAnchorId.value = anchorId
  dayOffset.value = Math.max(segments.length, 1)
  planStage(nextSegmentSeed(prev), !prev.endPoint)
}

/**
 * "Split into daily stages" on a saved tour (map-first-tour-creation D5): it keeps its first day,
 * and the route step opens for the next one — the span's days numbered on.
 */
function handleSplitTour(anchorId: string) {
  const anchor = tours.value.find(t => t.id === anchorId)
  if (!anchor?.plannedDate || !anchor.endDate)
    return
  const segments = outingSegments(tours.value, outingKey(anchor))
  closeOverlay()
  segmentAnchorId.value = anchorId
  splitAnchor.value = true
  dayOffset.value = Math.max(segments.length, 1)
  dayCount.value = dayOffset.value - 1 + spanDays({ start: anchor.plannedDate, end: anchor.endDate })
  planStage(nextSegmentSeed({ ...anchor, endDate: null }), !anchor.endPoint)
}

/**
 * "Plan as tour" on a ski route (smarter-tour-creation D7): open the creation form on the route's
 * summit, seeded with its facts and its line as the track, which sets start and end (design D9).
 */
async function handlePlanFromRoute(trail: Trail) {
  const plan = trail.route && await planFromRoute(trail.route, trail.lines, locale.value)
  if (!plan)
    return
  const { goal, seed, track } = plan
  closeOverlay()
  stages.value = [{ key: uuidv4(), goal, seed, picks: null, drawnTrack: track }]
  openOverlay('tour-creation')
}

function handleEditContact(contactId: string) {
  editContactId.value = contactId
  openOverlay('contacts')
}

function handleContactsClose() {
  editContactId.value = null
  closeOverlay()
}

/** A friend's contact detail → their tours (#362): the list on Friends, filtered to them. */
function handleShowFriendTours(userId: string) {
  editContactId.value = null
  showFriendTours(userId)
  openOverlay('tours')
}

// The map shows what a narrowed list shows (#351) — only while the list itself is open: a tour or
// outing opened from it owns the map anyway, and the filters outlive a route change to the
// calendar (it unmounts this page without the reset watch), so they must never thin a bare map.
const listedTourIds = useListedTourIds()
const mapListedTourIds = computed(() => (activeOverlay.value === 'tours' ? listedTourIds.value : null))

const { openEntry: openInboxEntry, snackbar: inboxSnackbar } = useInboxNavigation({
  overlay: name => openOverlay(name),
  tour: (tourId) => {
    closeOverlay()
    mapStore.selectTour(tourId)
  },
})

// Section the next profile open lands on; plain menu opens show the overview.
const profileSection = ref<'notifications' | undefined>()
watch(activeOverlay, (name) => {
  if (name !== 'profile')
    profileSection.value = undefined
})

function openNotificationSettings() {
  profileSection.value = 'notifications'
  openOverlay('profile')
}

function handleOpenFriendRequests() {
  editContactId.value = null
  openOverlay('friend-requests')
}

// Leaving the tour list resets its search + filters; a tour or outing opened from it is still "in" it.
watch(activeOverlay, (name) => {
  if (name !== 'tours' && name !== 'tour' && name !== 'outing')
    resetTourFilters()
})

// Keep activeOverlay in sync when selectedTourId is mutated externally. A segment → overview
// switch clears the tour too; the outing watch below takes over then.
watch(selectedTourId, (id) => {
  if (id) {
    activeOverlay.value = 'tour'
  }
  else if (activeOverlay.value === 'tour' && !selectedOutingKey.value) {
    activeOverlay.value = null
  }
})

watch(selectedOutingKey, (key) => {
  if (key)
    activeOverlay.value = 'outing'
  else if (activeOverlay.value === 'outing' && !selectedTourId.value)
    activeOverlay.value = null
})

// Close the overview when its outing dissolves or its segments are deleted.
watch(selectedOutingSegments, (segments) => {
  if (selectedOutingKey.value && segments.length === 0)
    mapStore.selectOuting(null)
})

// Deselect when a realtime refetch removes the selected tour from the list
watch(selectedTour, (tour) => {
  if (!tour && selectedTourId.value !== null) {
    mapStore.selectTour(null)
  }
})

onMounted(async () => {
  // Welcome must not wait on tours/contacts: gate it on the profile alone so it
  // appears immediately. Profile is normally already loaded (guard), so this is
  // the cold-profile fallback for the synchronous setup call above.
  if (!userProfileStore.profile)
    await userProfileStore.loadProfile()
  onboardingTour.maybeStartTour()
  maybeShowCalendarFeatureNotice()
  // Suggestions load here too: realtime's onSubscribed refetches once connected, but
  // OFFLINE no subscribe ever fires, and the cached snapshot is what keeps the pending
  // indicator truthful rather than a silent zero (design D14).
  await Promise.all([
    toursStore.loadTours(),
    contactsStore.loadContacts(),
    tourSuggestionsStore.load(),
    inboxStore.load(),
  ])

  // Consume a one-shot handoff from the calendar route (open the tours list, or
  // select a tour and remember its calendar origin). Tours are loaded above, and
  // the Pinia stores persist across the route change, so friend tours picked on
  // the calendar are already present. Selecting a tour trips the selectedTourId
  // watch → opens detail + flies to it.
  const intent = mapStore.consumePendingIntent()
  if (intent?.openTours) {
    activeOverlay.value = 'tours'
  }
  else if (intent?.selectTourId) {
    tourDetailOrigin.value = intent.origin ?? null
    tourDetailOriginDay.value = intent.originDay ?? null
    mapStore.selectTour(intent.selectTourId)
  }
})

// ponytail: mirrors `.side-drawer { width }` — measure it if the drawer ever resizes.
const SIDE_DRAWER_WIDTH = 400

/** The map area the open drawer (desktop) or sheet (phone) covers: camera moves frame beside it. */
const mapCovered = computed(() => isDesktop.value
  ? activeOverlay.value ? { right: SIDE_DRAWER_WIDTH } : {}
  : { bottom: sheetInset.value })

/** Frame the open tour, or every segment of the open outing. */
async function flyToSelectedTour() {
  if (!selectedTour.value && selectedOutingSegments.value.length === 0)
    return
  await nextTick()
  // On mobile the sheet is inside a Transition mode="out-in" container — if the previous
  // overlay is still leaving, sheetContainerRef won't be mounted yet. Defer until it is.
  if (!isDesktop.value && !sheetContainerRef.value) {
    pendingFlyTo.value = true
    return
  }
  pendingFlyTo.value = false
  // Mobile: let the sheet fit its content first (its ResizeObserver runs before the
  // next paint), so the camera frames against the height it will rest at.
  if (!isDesktop.value)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const map = mapInstance.value
  const framed = selectedTour.value ? [selectedTour.value] : selectedOutingSegments.value
  if (!map || framed.length === 0)
    return
  frameTours(map, framed, mapCovered.value)
}

watch(sheetContainerRef, async (el) => {
  if (el && pendingFlyTo.value)
    await flyToSelectedTour()
})

watch([selectedTourId, selectedOutingKey], async ([id, key]) => {
  if (id || key)
    await flyToSelectedTour()
})

watch(
  () => mapRef.value?.map,
  (m) => {
    if (!m)
      return
    const update = () => {
      mapBearing.value = m.getBearing()
    }
    m.on('rotate', update)
    m.on('rotateend', update)
    update()
  },
)

function handleResetBearing() {
  mapRef.value?.map?.easeTo({ bearing: 0, pitch: 0, duration: 300 })
}

function handleTourClicked(tourId: string) {
  // A tap while drawing or planning sets a point there instead; beside the creation form (desktop)
  // it must not swap the unsaved tour for another.
  if (isDrawingTrack.value || planner.value || activeOverlay.value === 'tour-creation')
    return
  const tour = allTours.value.find(t => t.id === tourId)
  const key = tour ? outingKey(tour) : null
  const focused = selectedOutingKey.value ?? (selectedTour.value ? outingKey(selectedTour.value) : null)
  // A segment of an outing not open yet shows the whole outing first (D15); inside the open
  // outing, a tap opens that segment.
  if (key && key !== focused && outingSegments(allTours.value, key).length > 0) {
    openOuting(key, null)
    return
  }
  if (key && key === selectedOutingKey.value)
    tourDetailOrigin.value = 'outing'
  mapStore.selectTour(tourId)
  openOverlay('tour')
}

/** The crosshair pick of a saved tour's edit; the form names the point and looks up its height. */
function handleLocationConfirmed({ name, ...location }: { lng: number, lat: number, name?: string }) {
  mapStore.setPickingLocation(false)
  const pickType = pendingPickType.value as PickPointType
  isPickingForEdit.value = false
  pendingPickType.value = 'goal'
  // Tentative goal as a lighter-tone preview marker until edit mode closes,
  // color is already held by previewTourTypes, so no changes needed here.
  if (pickType === 'goal')
    mapStore.setPreviewGoal(location)
  editPickedPoint.value = { type: pickType, location, name }
}

function handleLocationCancelled() {
  mapStore.setPickingLocation(false)
  isPickingForEdit.value = false
  pendingPickType.value = 'goal'
}

// ── Route step (map-first-tour-creation D1–D3) ──────────────────────────────
function openPlanner(state: PlannerState) {
  planner.value = state
  plannerRun.value++
  mapStore.setPickingLocation(true)
}

function closePlanner() {
  planner.value = null
  plannerPoints.value = null
  mapStore.setPickingLocation(false)
}

function pointOf(location: { lng: number, lat: number } | null, name: string | null, elevation: number | null) {
  return location && { location, name: name || null, elevation, loading: false }
}

/**
 * The route step for a new stage: its seed's start set, its goal next. A start at the previous
 * stage's goal (`lookupStart`) carries that tour's name, not the place's: the step names it.
 */
function planStage(seed: TourDraft | null, lookupStart = false) {
  const start = seed && pointOf(seed.startPoint, lookupStart ? null : seed.startPointName, seed.startPointElevation)
  if (start && lookupStart)
    start.loading = true
  openPlanner({ initial: { ...NO_ROUTE, start }, step: start ? 'goal' : 'start', stage: stages.value.length, seed: seed && lookupStart ? { ...seed, startPointName: null } : seed })
}

/** "+" (bar or list): a new tour starts on the map, with its start. */
function startNewTour() {
  closeOverlay()
  mapStore.selectTour(null)
  resetTourCreationState()
  planStage(null)
}

/** The form's Pick / Change: back to the route step on that point, with the stage's points (D3). */
function handlePickPoint(type: RouteStep) {
  const route = creationRef.value?.route()
  const stage = stages.value[activeStage.value]
  if (!route || !stage)
    return
  openPlanner({
    initial: {
      goal: pointOf(stage.goal, route.goal.name, route.goal.elevation),
      start: route.start && pointOf(route.start.location, route.start.name, route.start.elevation),
      end: route.end && pointOf(route.end.location, route.end.name, route.end.elevation),
    },
    step: type,
    stage: activeStage.value,
    seed: null,
  })
}

/** What moved in the route step, for the form: a found name and height go along (D2). */
function changedPoints(before: RoutePoints, after: RoutePoints): PointChange[] {
  return ROUTE_STEPS.flatMap((type): PointChange[] => {
    const [was, now] = [before[type], after[type]]
    if (!now)
      return was && type !== 'goal' ? [{ type, location: null }] : []
    if (was && !was.loading && was.location.lng === now.location.lng && was.location.lat === now.location.lat)
      return []
    const found = now.loading ? {} : { name: now.name ?? undefined, elevation: now.elevation }
    return [{ type, location: now.location, ...found }]
  })
}

function handlePlannerDone(points: RoutePoints) {
  const state = planner.value
  const goal = points.goal?.location
  if (!state || !goal)
    return
  closePlanner()
  const picks = changedPoints(state.initial, points)
  if (state.stage >= stages.value.length) {
    stages.value = [...stages.value, { key: uuidv4(), goal, seed: state.seed, picks, drawnTrack: null }]
    activeStage.value = stages.value.length - 1
    openOverlay('tour-creation')
    // A split span (D5) goes on day by day: the next day's route step follows at once, from here.
    if (state.seed && dayCount.value && dayOffset.value + stages.value.length < dayCount.value) {
      const { goal: at, end } = points
      planStage(nextSegmentSeed({
        ...state.seed,
        name: at!.name ?? '',
        elevation: at!.elevation,
        endPoint: end?.location ?? null,
        endPointName: end?.name ?? null,
        endPointElevation: end?.elevation ?? null,
        goal,
      }), !end)
      return
    }
  }
  else {
    stages.value = stages.value.map((s, i) => (i === state.stage ? { ...s, goal, picks } : s))
  }
  void frameDraft()
}

/** Leaving the route step: back to the form as it was — or, before there is one, no tour at all. */
function handlePlannerCancel() {
  closePlanner()
  if (stages.value.length === 0)
    resetTourCreationState()
}

/** "+ Next day" (D4) — or a span split into days (D5): the route step of the day after the last stage. */
function handleNextDay(split?: number) {
  const last = stages.value.length - 1
  const draft = creationRef.value?.snapshotOf(last)
  const stage = stages.value[last]
  if (!draft || !stage)
    return
  if (split)
    dayCount.value = dayOffset.value + last + split
  planStage(nextSegmentSeed({ ...draft, goal: stage.goal }), !draft.endPoint)
}

/** A later stage dropped (its form already discarded its uploads): the one before it shows. */
function handleRemoveStage(index: number) {
  const key = stages.value[index]?.key
  stages.value = stages.value.filter((_, i) => i !== index)
  if (key) {
    const { [key]: _gone, ...rest } = stageLive.value
    stageLive.value = rest
  }
  activeStage.value = Math.max(0, index - 1)
}

function handleStageChange(index: number, change: StageLive) {
  const key = stages.value[index]?.key
  if (key)
    stageLive.value = { ...stageLive.value, [key]: { ...stageLive.value[key], ...change } }
}

const creationTitle = computed(() => {
  if (splitAnchor.value)
    return t('tours.creation.splitTitle')
  return segmentAnchorId.value ? t('tours.outing.addTitle') : t('tours.creation.title')
})

/** "Day 2" past the first stage (or the anchor's); "Day 2 of 3" while laying out a split span. */
function dayTitle(stage: number) {
  const n = dayOffset.value + stage + 1
  return dayCount.value && n <= dayCount.value ? t('tours.creation.dayOf', { n, count: dayCount.value }) : t('tours.creation.day', { n })
}
const plannerTitle = computed(() => {
  const state = planner.value
  if (!state)
    return ''
  return state.stage > 0 || segmentAnchorId.value ? dayTitle(state.stage) : t('tours.creation.title')
})

/** The map's draft: every stage, the planned one as the route step has it (D7). */
const draftStages = computed<DraftStage[]>(() => {
  const out: DraftStage[] = stages.value.map((s) => {
    const live = stageLive.value[s.key]
    return { goal: s.goal, startPoint: live?.start ?? null, endPoint: live?.end ?? null, tourTypes: live?.tourTypes ?? s.seed?.tourTypes ?? [], legs: null, track: live?.track ?? null }
  })
  const state = planner.value
  const points = plannerPoints.value
  if (state && points) {
    const base = out[state.stage] ?? { tourTypes: state.seed?.tourTypes ?? [], legs: null, track: null }
    out[state.stage] = { ...base, goal: points.goal?.location ?? null, startPoint: points.start?.location ?? null, endPoint: points.end?.location ?? null }
  }
  return out
})
/** The draft held on the map while a save is under way, until the real markers replace it. */
const heldPreview = ref<DraftStage[] | null>(null)
watch(() => heldPreview.value ?? draftStages.value, shown => mapStore.setPreviewStages(shown), { immediate: true })
// The active stage's activities pick what a drawing follows (#323).
watch(() => stageLive.value[stages.value[activeStage.value]?.key ?? '']?.tourTypes, (types) => {
  if (stages.value.length > 0)
    mapStore.setPreviewTourTypes(types ?? [])
})

/** On desktop the drawer opens over the map's right side: keep the draft in view beside it. */
async function frameDraft() {
  if (!isDesktop.value)
    return
  await nextTick()
  const map = mapInstance.value
  const points = draftStages.value.flatMap(s => [s.goal, s.startPoint, s.endPoint].filter(p => p !== null))
  if (!map || points.length === 0)
    return
  const bounds = points.reduce((b, p) => b.extend([p.lng, p.lat]), new LngLatBounds())
  if (!isBoundsVisible(map, bounds, mapCovered.value))
    frameBounds(map, bounds, mapCovered.value)
}

function handleInfoSheetPickPoint(type: 'start' | 'end' | 'goal') {
  isPickingForEdit.value = true
  pendingPickType.value = type
  mapStore.setPickingLocation(true)
}

function handlePointConsumed() {
  editPickedPoint.value = null
  editDrawnTrack.value = null
}

/** The form asks to draw its track, going on from its current one. */
function handleDrawTrack(seed: DrawnTrack | null, forEdit = false) {
  isPickingForEdit.value = forEdit
  trackSeed.value = seed
  mapStore.setDrawingTrack(true)
}

function handleTrackDrawn(track: DrawnTrack) {
  mapStore.setDrawingTrack(false)
  trackSeed.value = null
  if (isPickingForEdit.value)
    editDrawnTrack.value = track
  else
    stages.value = stages.value.map((s, i) => (i === activeStage.value ? { ...s, drawnTrack: track } : s))
  isPickingForEdit.value = false
}

function handleTrackCancelled() {
  mapStore.setDrawingTrack(false)
  trackSeed.value = null
  isPickingForEdit.value = false
}

async function handleEditModeChange(editing: boolean) {
  if (!editing) {
    // Cancel/save: drop previews and recenter on the (possibly updated) tour goal
    clearTourPreview()
    await flyToSelectedTour()
  }
}

// Tear down every preview overlay tied to a viewed/edited tour: the tentative
// goal, its draft type tint, and the draft start/end points. Called on close,
// back, overlay-switch and edit-exit so nothing leaks into the next selection.
// A stale previewTourTypes in particular would mis-color the next tour's
// start/end markers, since they read it as a draft override.
function clearTourPreview() {
  mapStore.setPreviewGoal(null)
  mapStore.setPreviewTourTypes(null)
  mapStore.setPreviewStart(null)
  mapStore.setPreviewEnd(null)
  mapStore.setPreviewTrack(null)
}

// A working start/end is a *draft* marker only when it differs from the tour's
// saved point (during creation there is no saved point, so it's always draft).
function draftIfChanged(
  point: { lng: number, lat: number } | null,
  saved: { lng: number, lat: number } | null,
) {
  if (!point)
    return null
  if (!saved)
    return point
  return isSameGoal(point, saved) ? null : point
}

function handleStartPointChange(point: { lng: number, lat: number } | null) {
  mapStore.setPreviewStart(draftIfChanged(point, selectedTour.value?.startPoint ?? null))
}

function handleEndPointChange(point: { lng: number, lat: number } | null) {
  mapStore.setPreviewEnd(draftIfChanged(point, selectedTour.value?.endPoint ?? null))
}

// The map's own bottom messages: ski route lookups, a tour saved twice.
const notice = useSnackbar()
const noticeInfo = ref(false)
function showNotice(message: string, info: boolean) {
  noticeInfo.value = info
  notice.show(message)
}

// --- Ski route lookup --------------------------------------------------------
const trailLookup = useTrailLookup({
  map: () => mapInstance.value,
  locale: () => locale.value,
  onError: () => showNotice(t('map.trail.lookupError'), false),
})

// A ski tile failing without HTTP status while online = the dataset moved on (see useTrailLookup).
watch(mapInstance, m => m?.on('error', (e) => {
  if (isOnline.value)
    trailLookup.onMapError(e)
}))

/**
 * A new tour's route step (not a segment's, not a next day's): there a tap on a marked ski route
 * opens its card, to plan it as the tour with its line as track (#323) — closing the card goes back.
 */
const routesTappableInPick = computed(() => !!planner.value && stages.value.length === 0 && !segmentAnchorId.value
  && activeOverlays.value.includes('ski') && isOnline.value)

/** A tap the route step leaves to the page: one on a marked ski route, where the card opens. */
function plannerRouteHit(point: Point) {
  return routesTappableInPick.value && (mapInstance.value?.getZoom() ?? 0) >= TRAIL_LOOKUP_MIN_ZOOM
    && trailLookup.hitTest(point).ids.length > 0
}

async function openRouteFromPick(point: Point) {
  const hits = await trailLookup.lookup(point)
  const state = planner.value
  if (!hits?.candidates.length || !routesTappableInPick.value || !state)
    return
  const points = plannerPoints.value ?? state.initial
  pausedPlanner.value = { ...state, initial: points, step: points.goal ? 'end' : points.start ? 'goal' : 'start' }
  closePlanner()
  mapStore.showTrails(hits.candidates, hits.more)
  openOverlay('trail-info')
}

function handleTrailCardClose() {
  const resume = pausedPlanner.value
  closeOverlay()
  if (resume)
    openPlanner(resume)
}

// The trail card is the one sheet *about* the map, so a tap re-looks-up; every
// other sheet keeps "tap map = close".
async function handleMapBackgroundClick({ point }: { point: Point }) {
  // Suppress while location picker or region-draw is active — map panning passes
  // through the overlay and would otherwise deselect the current tour.
  if (isPickingLocation.value || isDrawingRegion.value) {
    if (plannerRouteHit(point))
      await openRouteFromPick(point)
    return
  }
  // The creation form beside the map (desktop) keeps its unsaved tour: a stray map click is no cancel.
  if (activeOverlay.value === 'tour-creation')
    return
  const map = mapInstance.value
  const otherSheet = activeOverlay.value !== null && activeOverlay.value !== 'trail-info'
  // Below the marking zoom nothing looks tappable, so a tap is a plain map tap.
  if (otherSheet || !map || !activeOverlays.value.includes('ski') || map.getZoom() < TRAIL_LOOKUP_MIN_ZOOM) {
    closeOverlay()
    return
  }
  // Offline the routes still render (downloaded or cached tiles) but their details can't load.
  if (!isOnline.value) {
    if (trailLookup.hitTest(point).ids.length > 0)
      showNotice(t('map.trail.offline'), true)
    closeOverlay()
    return
  }
  const hits = await trailLookup.lookup(point)
  // null: load failed or superseded (map unchanged). Another sheet opened meanwhile wins.
  if (!hits || (activeOverlay.value !== null && activeOverlay.value !== 'trail-info'))
    return
  if (hits.candidates.length === 0) {
    closeOverlay()
    return
  }
  mapStore.showTrails(hits.candidates, hits.more)
  openOverlay('trail-info')
}

// One rule for every way out of the card: close, tour selection, any other sheet.
watch(activeOverlay, (name) => {
  if (name !== 'trail-info') {
    mapStore.clearTrails()
    pausedPlanner.value = null
  }
})

// Frame what the card highlights (all candidates, or the chosen route) beside the
// sheet/drawer — only when it isn't already fully visible there. A route chosen from
// the list is always framed, to fill that area.
watch(() => [trailCard.value?.candidates, trailCard.value?.selectedId], async () => {
  if (!trailCard.value)
    return
  await nextTick()
  if (!isDesktop.value)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const card = trailCard.value
  const map = mapInstance.value
  if (!card || !map)
    return
  const bounds = new LngLatBounds()
  for (const trail of card.candidates) {
    if (!card.selectedId || trail.id === card.selectedId)
      trail.lines.forEach(line => line.forEach(c => bounds.extend(c)))
  }
  const covered = mapCovered.value
  // Read after the waits: a back tap meanwhile turns this into a list frame.
  // A lone lookup hit opens straight on its details, so a choice needs several.
  const chosenFromList = !!card.selectedId && card.candidates.length > 1
  if (bounds.isEmpty())
    return
  if (chosenFromList)
    frameBounds(map, bounds, covered, { maxZoom: ROUTE_ZOOM })
  else if (!isBoundsVisible(map, bounds, covered))
    frameBounds(map, bounds, covered)
})

// --- Offline maps ------------------------------------------------------------
// Flow: speed-dial → manage sheet → {draw a region | whole map} → download sheet.
function handleStartDrawRegion() {
  closeOverlay()
  mapStore.setDrawingRegion(true)
}

function handleRegionDrawn(bbox: [number, number, number, number]) {
  mapStore.setDrawingRegion(false)
  offlineBbox.value = bbox
  openOverlay('offline-download')
}

function handleRegionDrawCancel() {
  mapStore.setDrawingRegion(false)
  openOverlay('offline-manage')
}

function handleDownloadWhole(bbox: [number, number, number, number]) {
  offlineBbox.value = bbox
  openOverlay('offline-download')
}

function handleOfflineDownloadDone() {
  offlineBbox.value = null
  openOverlay('offline-manage')
}

function dismissActive() {
  closeOverlay()
  mapOverlayRef.value?.closeMenu()
}

function handleBarTours() {
  if (barState.value.toursAction === 'dismiss') {
    dismissActive()
    return
  }
  openOverlay('tours')
}

function handleBarAddTour() {
  if (barState.value.addTourAction === 'dismiss') {
    dismissActive()
    return
  }
  if (barState.value.addTourAction === 'pick')
    startNewTour()
}

async function handleTourCreated(payloads: StagePayload[]) {
  // Capture the anchor before closeOverlay resets state; the draft stays on the map through the
  // save until the real markers replace it, and goes on failure too.
  const anchorId = segmentAnchorId.value
  const keepFirstDay = splitAnchor.value
  const days = (anchorId ? dayOffset.value : 0) + payloads.length
  const shown = draftStages.value
  closeOverlay()
  heldPreview.value = shown
  try {
    await performCreate(payloads, anchorId, keepFirstDay, days)
  }
  finally {
    heldPreview.value = null
  }
}

async function performCreate(payloads: StagePayload[], anchorId: string | null, keepFirstDay: boolean, days: number) {
  const [only] = payloads
  if (payloads.length === 1 && only && !anchorId) {
    // The same tour again (a ski route planned twice, every field left as it came): open the one
    // there is instead of a copy. Attachments make it another tour.
    const twin = !attachmentsStore.preUploadedByDraft[only.draftId]?.length
      ? await toursStore.dropIfDuplicate(only.draft, only.goal)
      : null
    if (twin) {
      mapStore.selectTour(twin.id)
      showNotice(t('tours.creation.alreadyThere'), true)
      return
    }
    await createStage(only, undefined)
    return
  }
  // Stages (D4): a split tour keeps its first day (D5), the anchor joins (or mints) the outing,
  // then each stage is created after the last segment, in order — so a cancelled layout never
  // leaves an outing behind.
  if (anchorId && keepFirstDay)
    await toursStore.keepFirstDay(anchorId)
  const outing = anchorId ? await toursStore.ensureOuting(anchorId) : { id: uuidv4(), name: null, position: 0 }
  if (!outing)
    return
  const first = anchorId ? toursStore.nextInOuting(outing).position : 0
  let lastId: string | null = null
  for (const [i, stage] of payloads.entries())
    lastId = await createStage(stage, { ...outing, position: first + i }, false) ?? lastId
  // One new segment opens as itself; a laid-out trip opens on its overview.
  const userId = authStore.currentUser?.id
  if ((payloads.length > 1 || keepFirstDay) && userId) {
    openOuting(outingKey({ userId, outing })!, null)
    showNotice(t('tours.creation.savedDays', { count: days }), true)
  }
  else if (lastId) {
    mapStore.selectTour(lastId)
  }
}

/** Create one stage; its attachments' rows follow (the bytes are already in Storage, design D5). */
async function createStage(stage: StagePayload, outing: TourDraft['outing'], select = true) {
  const id = await toursStore.createTourFromDraft(outing ? { ...stage.draft, outing } : stage.draft, stage.goal, stage.preUploadedTourId)
  if (!id)
    return null
  if (select)
    mapStore.selectTour(id)
  if (stage.draftId)
    await attachmentsStore.commitStaged(stage.draftId, id)
  return id
}

function handleDialogClose() {
  closeOverlay()
}
</script>

<template>
  <div class="map-page" :class="{ 'map-page--tour-locked': tourRunning || tourWelcome }">
    <!-- Teleported to <body> so it shares driver.js' top-level stacking context
         (driver appends its overlay to body) — keeps the banner above the
         spotlight overlay and, crucially, clickable. -->
    <Teleport to="body">
      <Transition name="tour-slide">
        <OnboardingTourBanner
          v-if="tourRunning" :title="tourTitle" :current="tourIndex + 1" :total="tourTotal"
          :can-back="tourIndex > 0" :busy="tourStaging" @back="onboardingTour.back()" @next="onboardingTour.next()"
          @finish="onboardingTour.finish()"
        />
      </Transition>
    </Teleport>

    <!-- Pre-tour welcome (auto-start only). Teleported to <body> so it stacks
         above the map + sheets, the same as the tour banner. -->
    <Teleport to="body">
      <Transition name="welcome">
        <OnboardingWelcome
          v-if="tourWelcome" @start="onboardingTour.startFromWelcome()"
          @skip="onboardingTour.skipWelcome()" @dismiss="onboardingTour.dismissWelcome()"
        />
      </Transition>
    </Teleport>

    <Teleport to="body">
      <DialogWindow
        v-if="showCalendarFeatureNotice"
        :title="t('calendar.featureNotice.title')"
        @close="dismissCalendarFeatureNotice"
      >
        <div class="calendar-feature-notice">
          <p>{{ t('calendar.featureNotice.body') }}</p>
          <BaseButton size="md" @click="dismissCalendarFeatureNotice">
            {{ t('calendar.featureNotice.cta') }}
          </BaseButton>
        </div>
      </DialogWindow>
    </Teleport>

    <ErrorSnackbar :message="inboxSnackbar.snackbar.value.message" :visible="inboxSnackbar.snackbar.value.visible" @dismiss="inboxSnackbar.dismiss" />
    <ErrorSnackbar
      :message="notice.snackbar.value.message" :visible="notice.snackbar.value.visible"
      :info="noticeInfo" @dismiss="notice.dismiss"
    />

    <TourenbuddyMap
      ref="mapRef" :covered="mapCovered" :listed-tour-ids="mapListedTourIds" @tour-clicked="handleTourClicked"
      @map-background-click="handleMapBackgroundClick"
    />

    <MapActionOverlay
      ref="mapOverlayRef" :bearing="mapBearing" :overlay-active="activeOverlay !== null"
      @open-feedback="openOverlay('feedback')" @open-profile="openOverlay('profile')"
      @open-contacts="openOverlay('contacts')" @open-offline-map="openOverlay('offline-manage')"
      @open-inbox="openOverlay('inbox')"
      @reset-bearing="handleResetBearing" @dismiss-overlay="closeOverlay"
    />

    <TourActionBar
      :visible="barState.visible && !isDrawingRegion" :tours-disabled="barState.toursAction === 'dismiss'"
      :add-tour-disabled="barState.addTourAction === 'dismiss' || barState.addTourAction === 'disabled'"
      :add-tour-tooltip="addTourTooltip" :dismiss-mode="barState.toursAction === 'dismiss'" @tours="handleBarTours"
      @add-tour="handleBarAddTour"
    />

    <LocationPicker
      v-if="isPickingLocation && !isDrawingTrack && !planner" :map="mapInstance" :role="pendingPickType"
      :actions-bottom="!isDesktop && isPickingForEdit ? 80 : undefined"
      @confirm="handleLocationConfirmed" @cancel="handleLocationCancelled" @searching="pickerSearching = $event"
    />

    <RoutePlanner
      v-if="planner && mapInstance" :key="plannerRun" :map="mapInstance" :initial="planner.initial" :step="planner.step"
      :title="plannerTitle" :done-label="planner.stage < stages.length ? t('map.plan.done') : t('map.plan.continue')"
      :route-hit="plannerRouteHit" :hint="routesTappableInPick ? t('tours.picker.routeHint') : undefined" :covered="mapCovered"
      @change="plannerPoints = $event" @done="handlePlannerDone" @cancel="handlePlannerCancel"
    />

    <TrackDrawer
      v-if="isDrawingTrack && mapInstance" :map="mapInstance" :seed="trackSeed" :tour-types="previewTourTypes ?? []"
      @done="handleTrackDrawn" @cancel="handleTrackCancelled"
    />

    <OfflineRegionDraw
      v-if="isDrawingRegion" :map="mapInstance"
      @confirm="handleRegionDrawn" @cancel="handleRegionDrawCancel"
    />

    <!-- Read-only outline of the confirmed extent while the download sheet is open. -->
    <OfflineRegionOutline
      v-if="offlineBbox && activeOverlay === 'offline-download'"
      :map="mapInstance" :bbox="offlineBbox"
    />

    <!-- Overlays: only one visible at a time; mode="out-in" ensures the active overlay
         leaves before the incoming one enters, preventing visual stacking.
         On desktop, the container uses display:contents so fixed-position dialogs
         position themselves independently and animate via their own CSS. -->
    <Transition :name="sheetTransition" mode="out-in">
      <div v-if="selectedTour && activeOverlay === 'tour'" key="tour" ref="sheetContainerRef" class="sheet-host">
        <TourInfoSheet
          :tour="selectedTour" :edit-picked-point="editPickedPoint" :show-back="tourDetailOrigin !== null"
          :back-text="tourDetailOrigin === 'outing' ? t('tours.outing.backToOuting') : undefined"
          :active-pick-type="isPickingForEdit ? pendingPickType : null" :edit-drawn-track="editDrawnTrack"
          @close="closeOverlay" @back="handleTourInfoBack"
          @pick-point="(t: 'start' | 'end' | 'goal') => handleInfoSheetPickPoint(t)"
          @draw-track="handleDrawTrack($event, true)" @track-change="mapStore.setPreviewTrack($event)"
          @point-consumed="handlePointConsumed" @edit-mode-change="handleEditModeChange"
          @edit-contact="handleEditContact" @tour-types-change="mapStore.setPreviewTourTypes($event)"
          @start-point-change="handleStartPointChange" @end-point-change="handleEndPointChange"
          @open-outing="handleInfoSheetOpenOuting" @add-segment="handleAddSegment" @split-days="handleSplitTour"
        />
      </div>
      <div
        v-else-if="selectedOutingKey && activeOverlay === 'outing'" key="outing" ref="sheetContainerRef"
        class="sheet-host"
      >
        <OutingOverviewSheet
          :outing-key="selectedOutingKey" :show-back="outingOrigin === 'list'" @close="closeOverlay"
          @back="handleOutingBack" @open-segment="handleOpenSegment" @add-segment-new="handleAddSegment"
        />
      </div>
      <div v-else-if="showFeedbackSheet" key="feedback" class="sheet-host">
        <FeedbackSheet @close="closeOverlay" />
      </div>
      <div v-else-if="showProfileSheet" key="profile" class="sheet-host">
        <UserProfileSheet :initial-section="profileSection" @close="closeOverlay" />
      </div>
      <div v-else-if="showContactDialog" key="contacts" class="sheet-host">
        <ContactsListSheet
          :initial-contact-id="editContactId" @close="handleContactsClose"
          @open-friend-requests="handleOpenFriendRequests" @show-friend-tours="handleShowFriendTours"
        />
      </div>
      <div v-else-if="showFriendRequests" key="friend-requests" class="sheet-host">
        <FriendRequestsSheet @close="closeOverlay" @back="openOverlay('contacts')" />
      </div>
      <div v-else-if="activeOverlay === 'inbox'" key="inbox" class="sheet-host">
        <InboxOverlay @close="closeOverlay" @open="openInboxEntry" @open-settings="openNotificationSettings" />
      </div>
      <div v-else-if="showToursList" key="tours" class="sheet-host">
        <TourListSheet
          @close="closeOverlay" @select-tour="handleTourSelectedFromList"
          @select-outing="openOuting($event, 'list')"
          @add-tour="startNewTour"
        />
      </div>
      <div v-else-if="activeOverlay === 'offline-manage'" key="offline-manage" class="sheet-host">
        <OfflineManageSheet
          @close="closeOverlay" @start-draw="handleStartDrawRegion" @download-whole="handleDownloadWhole"
        />
      </div>
      <div v-else-if="activeOverlay === 'offline-download' && offlineBbox" key="offline-download" class="sheet-host">
        <OfflineDownloadSheet
          :bbox="offlineBbox" @close="handleOfflineDownloadDone" @done="handleOfflineDownloadDone"
        />
      </div>
      <div v-else-if="activeOverlay === 'trail-info' && trailCard" key="trail-info" class="sheet-host">
        <TrailCard @close="handleTrailCardClose" @plan="handlePlanFromRoute" />
      </div>
      <div v-else-if="showTourCreationDialog" key="tour-creation" class="sheet-host">
        <TourCreationDialog
          ref="creationRef" :stages="stages" :active="activeStage" :title="creationTitle" :day-offset="dayOffset"
          :day-count="dayCount" @confirm="handleTourCreated" @close="handleDialogClose" @select="activeStage = $event"
          @remove="handleRemoveStage" @pick-point="handlePickPoint" @draw-track="handleDrawTrack($event)"
          @next-day="handleNextDay" @stage-change="handleStageChange"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-page {
  /* fixed (not relative + 100lvh): pin the page to the viewport so the document
     never scrolls. Under `#app { min-height: 100lvh }`, a 100lvh page is taller
     than the visible browser viewport (lvh = chrome-hidden height), so the
     document scrolled and the map slid under the fixed sheet, opening a gap above
     the URL bar. `fixed inset:0` still fills the safe areas in PWA (viewport-fit
     cover) and stays a containing block for the absolutely-positioned overlays. */
  position: fixed;
  inset: 0;
  overflow: hidden;
}

/* During the guided tour (and its welcome screen) the whole app subtree is made
   inert: driver.js positions each spotlight/popover ONCE, so any MapLibre pan or
   sheet scroll would drag it off its target. This holds continuously — including
   the brief staging gaps where driver's own `pointer-events:none` is down. The
   banner, welcome, and driver's backdrop overlay are all teleported to <body>,
   outside this subtree, so they stay live and tap-to-advance keeps working.
   `pointer-events:none` blocks taps reaching the map+sheets; `touch-action:none`
   kills any residual touch-pan/scroll gesture. */
/* Hidden, not unmounted: the collapsed form keeps what was typed. */
:global(
  html.picker-searching
    :is(.full-screen-page--collapsed, .bottom-sheet--collapsed, .dialog-card--collapsed, .side-drawer--collapsed)
) {
  visibility: hidden;
}

.map-page--tour-locked {
  pointer-events: none;
  touch-action: none;
}

.calendar-feature-notice {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

/* MapLibre's attribution links differ from the surrounding text by color alone
   (2.02:1); an underline makes them identifiable (WCAG 1.4.1). */
:deep(.maplibregl-ctrl-attrib a) {
  text-decoration: underline;
}

/* Sheet → sheet: the outgoing sheet fades out quickly, the next one rises into place. */
.sheet-swap-enter-active,
.sheet-swap-leave-active {
  transition:
    transform var(--motion-duration-medium) var(--motion-ease-emphasized),
    opacity var(--motion-duration-medium) var(--motion-ease-standard);
}

.sheet-swap-leave-active {
  transition-duration: var(--motion-duration-short);
}

.sheet-swap-enter-from,
.sheet-swap-leave-to {
  transform: translateY(var(--motion-offset));
  opacity: 0;
}

/* On desktop, disable container transitions — each overlay animates itself */
@media (min-width: 600px) {
  .sheet-swap-enter-active,
  .sheet-swap-leave-active {
    transition: none;
  }

  .sheet-swap-enter-from,
  .sheet-swap-leave-to {
    transform: none;
    opacity: 1;
  }
}
</style>
