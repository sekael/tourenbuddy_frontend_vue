<script setup lang="ts">
import type { StageContext } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import type { TourSurface } from '@/features/onboarding/presentation/onboarding-steps'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import FeedbackSheet from '@/core/components/feedback-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useScrollLock } from '@/core/composables/use-scroll-lock'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { spanDayKeys } from '@/features/calendar/domain/calendar-dates'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import FriendRequestsSheet from '@/features/friendships/presentation/components/friend-requests-sheet.vue'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'
import MapActionOverlay from '@/features/map/presentation/components/map-action-overlay.vue'
import OfflineDownloadSheet from '@/features/map/presentation/components/offline-download-sheet.vue'
import OfflineManageSheet from '@/features/map/presentation/components/offline-manage-sheet.vue'
import OfflineRegionDraw from '@/features/map/presentation/components/offline-region-draw.vue'
import OfflineRegionOutline from '@/features/map/presentation/components/offline-region-outline.vue'
import TourActionBar from '@/features/map/presentation/components/tour-action-bar.vue'
import TourenbuddyMap from '@/features/map/presentation/components/tourenbuddy-map.vue'
import { computeBarState } from '@/features/map/presentation/composables/compute-bar-state'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { notifyTourInterest } from '@/features/notifications/data/notify-dispatch'
import { useNotificationsStore } from '@/features/notifications/presentation/stores/notifications-store'
import OnboardingTourBanner from '@/features/onboarding/presentation/components/onboarding-tour-banner.vue'
import OnboardingWelcome from '@/features/onboarding/presentation/components/onboarding-welcome.vue'
import { useOnboardingTour } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import { ONBOARDING_STEPS } from '@/features/onboarding/presentation/onboarding-steps'
import { useOnboardingTourStore } from '@/features/onboarding/presentation/stores/onboarding-tour-store'
import { getElevation } from '@/features/tours/data/services/swisstopo-elevation-service'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'
import { isSameGoal } from '@/features/tours/domain/distance'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'
import TourListSheet from '@/features/tours/presentation/components/tour-list-sheet.vue'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import UserProfileSheet from '@/features/user/presentation/components/user-profile-sheet.vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

type PickPointType = 'goal' | 'start' | 'end'
type OverlayName
  = | 'feedback'
    | 'profile'
    | 'contacts'
    | 'tours'
    | 'tour'
    | 'tour-creation'
    | 'friend-requests'
    | 'offline-manage'
    | 'offline-download'

const { t } = useI18n({ useScope: 'global' })
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
const isDesktop = useIsDesktop()

const { isPickingLocation, isDrawingRegion, selectedTourId } = storeToRefs(mapStore)
const { tours, friendTours } = storeToRefs(toursStore)
const { isAuthenticated } = storeToRefs(authStore)
const { reopenSignal } = storeToRefs(onboardingTourStore)

const mapRef = ref<InstanceType<typeof TourenbuddyMap> | null>(null)
const mapOverlayRef = ref<InstanceType<typeof MapActionOverlay> | null>(null)
const mapBearing = ref(0)

// Single source of truth for which overlay is open (at most one at a time)
const activeOverlay = ref<OverlayName | null>(null)

// Bounding box confirmed for an offline-map download (drawn region or whole map).
const offlineBbox = ref<[number, number, number, number] | null>(null)

// Location picking state
const pendingLocation = ref<{ lng: number, lat: number } | null>(null)
// 'goal' = main tour objective, 'start' = start point, 'end' = end point
const pendingPickType = ref<'goal' | 'start' | 'end'>('goal')

// Computed visibility flags for template readability
const showFeedbackSheet = computed(() => activeOverlay.value === 'feedback')
const showProfileSheet = computed(() => activeOverlay.value === 'profile')
const showContactDialog = computed(() => activeOverlay.value === 'contacts')
const showToursList = computed(() => activeOverlay.value === 'tours')
const showTourCreationDialog = computed(
  () =>
    activeOverlay.value === 'tour-creation'
    || (isPickingLocation.value
      && pendingPickType.value === 'goal'
      && pendingLocation.value === null
      && activeOverlay.value === null),
)
const showFriendRequests = computed(() => activeOverlay.value === 'friend-requests')

const barState = computed(() =>
  computeBarState({
    activeOverlay: activeOverlay.value,
    isPickingLocation: isPickingLocation.value,
    speedDialOpen: mapOverlayRef.value?.isOpen?.value ?? false,
    isAuthenticated: isAuthenticated.value,
  }),
)

const addTourTooltip = computed(() =>
  isAuthenticated.value ? undefined : t('map.overlay.signInToAddToursTooltip'),
)

// Pre-fill values for the creation dialog (from Swisstopo lookups & secondary picks)
const dialogInitialElevation = ref<number | null>(null)
const dialogInitialName = ref<string | null>(null)
const dialogInitialStartPoint = ref<{ lng: number, lat: number } | null>(null)
const dialogInitialEndPoint = ref<{ lng: number, lat: number } | null>(null)
const dialogInitialStartPointMeta = ref<{ name: string | null, elevation: number | null } | null>(
  null,
)
const dialogInitialEndPointMeta = ref<{ name: string | null, elevation: number | null } | null>(
  null,
)

// Derived reactively from store so it updates immediately when tours are mutated.
// Search friend tours too — a friend marker (partner tours) can be selected on the map.
const selectedTour = computed(
  () =>
    tours.value.find(t => t.id === selectedTourId.value)
    ?? friendTours.value.find(t => t.id === selectedTourId.value)
    ?? null,
)
const sheetContainerRef = ref<HTMLElement | null>(null)

// Whether the current location pick was triggered from the info sheet edit mode
const isPickingForEdit = ref(false)

// Set when flyToSelectedTour is called before sheetContainerRef has mounted
const pendingFlyTo = ref(false)

// Where the currently-open tour detail was entered from — drives the info
// sheet's back button target. `list` returns to the tours overlay; `cal-*`
// returns to the calendar route on the matching view; `null` = no back offered.
const tourDetailOrigin = ref<'list' | 'cal-seasons' | 'cal-planned' | null>(null)
// `cal-planned` only: the day cell the detail was opened from (a span covers several).
const tourDetailOriginDay = ref<string | null>(null)

// Contact id to auto-open in the contacts sheet (from tour chip edit-contact action)
const editContactId = ref<string | null>(null)

// Prop-based handoff to info sheet after a location pick in edit mode
const editPickedPoint = ref<{
  type: 'start' | 'end' | 'goal'
  location: { lng: number, lat: number }
  elevation?: number | null
  suggestedName?: string | null
} | null>(null)

function resetTourCreationState() {
  pendingLocation.value = null
  dialogInitialElevation.value = null
  dialogInitialName.value = null
  dialogInitialStartPoint.value = null
  dialogInitialEndPoint.value = null
  dialogInitialStartPointMeta.value = null
  dialogInitialEndPointMeta.value = null
  pendingPickType.value = 'goal'
  // Drop the draft marker on every cancel/dismiss path (closeOverlay, openOverlay
  // switching away). The save path re-asserts it afterwards so it survives the round-trip.
  mapStore.setPreviewGoal(null)
  mapStore.setPreviewTourType(null)
  mapStore.setPreviewStart(null)
  mapStore.setPreviewEnd(null)
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
  }
  if (activeOverlay.value === 'tour-creation') {
    resetTourCreationState()
  }
  activeOverlay.value = null
}

// --- Onboarding tour ---------------------------------------------------------
// The tour composable knows only abstract surfaces; this page owns the concrete
// overlays + speed-dial, so it translates each surface into open/close calls.
// Every step replays its full navigation path from a clean slate (overlays
// closed) so spotlight positions are deterministic — also when stepping back.
// Each waypoint carries a short hint ("Open menu", "Open contacts") via
// `ctx.spotlight(selector, hintKey)`, which waits for the control to settle
// before highlighting so the mask never lags an animation.
async function stageTourSurface(surface: TourSurface, ctx: StageContext) {
  // Open a speed-dial-backed sheet the way a user would: spotlight the FAB,
  // pop the menu, spotlight the menu item, then open the sheet.
  async function openViaMenu(name: OverlayName, itemSelector: string, itemHintKey: string) {
    await ctx.spotlight('[data-tour="open-menu"]', 'onboarding.tour.nav.openMenu')
    mapOverlayRef.value?.openMenu()
    await ctx.spotlight(itemSelector, itemHintKey)
    openOverlay(name)
  }

  closeOverlay()
  mapOverlayRef.value?.closeMenu()

  switch (surface) {
    case 'profile': {
      // Both profile targets sit in the vertically centered desktop dialog,
      // which is sized by its content: when the notification prefs fetch lands,
      // the section swaps its 96px loading placeholder for the full toggle
      // list, the card grows and re-centers, and an already-highlighted target
      // moves out from under its popover. Ensure prefs are loaded BEFORE the
      // highlight; the fetch overlaps the waypoint spotlights, so the wait is
      // normally free.
      const prefsReady = notificationsStore.prefs ? null : notificationsStore.loadPrefs()
      await openViaMenu('profile', '[data-tour="menu-profile"]', 'onboarding.tour.nav.profile')
      await prefsReady
      break
    }
    case 'contacts':
      await openViaMenu('contacts', '[data-tour="menu-contacts"]', 'onboarding.tour.nav.contacts')
      break
    case 'friend-requests':
      // Reached through the contacts sheet: open it, then spotlight the
      // switch-to-requests button before opening the requests view.
      await openViaMenu('contacts', '[data-tour="menu-contacts"]', 'onboarding.tour.nav.contacts')
      await ctx.spotlight('[data-tour="open-friend-requests"]', 'onboarding.tour.nav.friendRequests')
      openOverlay('friend-requests')
      break
    case 'tours':
      // The My-tours sheet opens from the bottom action bar, not the speed-dial.
      await ctx.spotlight('[data-tour="open-tours"]', 'onboarding.tour.nav.tours')
      openOverlay('tours')
      break
    case 'tour-bar':
      // No overlay — the bottom action bar (add-location button) is always visible.
      break
    case 'base-map-panel':
      await ctx.spotlight('[data-tour="open-menu"]', 'onboarding.tour.nav.openMenu')
      mapOverlayRef.value?.openMenu()
      await ctx.spotlight('[data-tour="menu-base-map"]', 'onboarding.tour.nav.baseMap')
      mapOverlayRef.value?.openBaseMap()
      break
  }
  await nextTick()
}

const onboardingTour = useOnboardingTour({
  steps: ONBOARDING_STEPS,
  stage: stageTourSurface,
  cleanup: () => {
    closeOverlay()
    mapOverlayRef.value?.closeMenu()
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
})

function handleTourSelectedFromList(tourId: string) {
  tourDetailOrigin.value = 'list'
  tourDetailOriginDay.value = null
  mapStore.selectTour(tourId)
  openOverlay('tour')
}

function handleTourInfoBack() {
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

function handleEditContact(contactId: string) {
  editContactId.value = contactId
  openOverlay('contacts')
}

function handleContactsClose() {
  editContactId.value = null
  closeOverlay()
}

function handleOpenFriendRequests() {
  editContactId.value = null
  openOverlay('friend-requests')
}

// Keep activeOverlay in sync when selectedTourId is mutated externally
watch(selectedTourId, (id) => {
  if (id) {
    activeOverlay.value = 'tour'
  }
  else if (activeOverlay.value === 'tour') {
    activeOverlay.value = null
  }
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

async function flyToSelectedTour() {
  if (!selectedTour.value)
    return
  await nextTick()
  // On mobile the sheet is inside a Transition mode="out-in" container — if the previous
  // overlay is still leaving, sheetContainerRef won't be mounted yet. Defer until it is.
  if (!isDesktop.value && !sheetContainerRef.value) {
    pendingFlyTo.value = true
    return
  }
  pendingFlyTo.value = false
  const padding = isDesktop.value
    ? { top: 0, right: 400, bottom: 0, left: 0 }
    : { top: 0, right: 0, bottom: sheetContainerRef.value?.offsetHeight ?? 0, left: 0 }
  mapRef.value?.map?.flyTo({
    center: [selectedTour.value.goal.lng, selectedTour.value.goal.lat],
    zoom: 12,
    duration: 1000,
    padding,
  })
}

watch(sheetContainerRef, async (el) => {
  if (el && pendingFlyTo.value)
    await flyToSelectedTour()
})

watch(selectedTourId, async (id) => {
  if (id)
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
  mapStore.selectTour(tourId)
  openOverlay('tour')
}

async function handleLocationConfirmed(location: { lng: number, lat: number }) {
  mapStore.setPickingLocation(false)

  // Pick triggered from the info sheet edit mode — route result back via prop
  if (isPickingForEdit.value) {
    const pickType = pendingPickType.value as PickPointType
    isPickingForEdit.value = false
    pendingPickType.value = 'goal'
    if (pickType === 'goal') {
      // Tentative goal as a lighter-tone preview marker until edit mode closes,
      // color is already held by previewTourType, so no changes needed here.
      mapStore.setPreviewGoal(location)
      // Run Swisstopo lookups in parallel (same as creation flow)
      const [elevation, suggestedName] = await Promise.all([
        getElevation(location),
        suggestTourName(location),
      ])
      editPickedPoint.value = { type: 'goal', location, elevation, suggestedName }
    }
    else {
      const [elevation, suggestedName] = await Promise.all([
        getElevation(location),
        suggestTourName(location),
      ])
      editPickedPoint.value = { type: pickType, location, elevation, suggestedName }
    }
    return
  }

  // Immediately hide the pill bar for the entire tour-creation flow — prevents
  // flickering during the async Swisstopo lookups between pick and dialog open.
  activeOverlay.value = 'tour-creation'

  if (pendingPickType.value === 'start') {
    dialogInitialStartPoint.value = location
    const [elevation, name] = await Promise.all([getElevation(location), suggestTourName(location)])
    dialogInitialStartPointMeta.value = { name, elevation }
    openOverlay('tour-creation')
    return
  }

  if (pendingPickType.value === 'end') {
    dialogInitialEndPoint.value = location
    const [elevation, name] = await Promise.all([getElevation(location), suggestTourName(location)])
    dialogInitialEndPointMeta.value = { name, elevation }
    openOverlay('tour-creation')
    return
  }

  // Change-goal during creation: pendingLocation is already set from the initial pick
  if (pendingPickType.value === 'goal' && pendingLocation.value !== null) {
    if (!isSameGoal(pendingLocation.value, location)) {
      pendingLocation.value = location
      // Move the single draft marker to the re-picked goal (no second marker).
      mapStore.setPreviewGoal(location)
      const [elevation, name] = await Promise.all([
        getElevation(location),
        suggestTourName(location),
      ])
      dialogInitialElevation.value = elevation
      dialogInitialName.value = name
    }
    pendingPickType.value = 'goal'
    openOverlay('tour-creation')
    return
  }

  // Initial goal pick: fire Swisstopo lookups in parallel before showing dialog
  pendingLocation.value = location
  // Show the draft marker immediately; type is neutral until the form picks one.
  mapStore.setPreviewGoal(location)
  const [elevation, name] = await Promise.all([getElevation(location), suggestTourName(location)])
  dialogInitialElevation.value = elevation
  dialogInitialName.value = name
  openOverlay('tour-creation')
}

function handleLocationCancelled() {
  mapStore.setPickingLocation(false)
  if (isPickingForEdit.value) {
    // Sheet stays visible; just reset the pick context
    isPickingForEdit.value = false
    pendingPickType.value = 'goal'
    return
  }
  // Re-open dialog if we were picking a secondary point for creation
  if (
    pendingPickType.value === 'start'
    || pendingPickType.value === 'end'
    || (pendingPickType.value === 'goal' && pendingLocation.value !== null)
  ) {
    openOverlay('tour-creation')
  }
  pendingPickType.value = 'goal'
}

function handlePickPoint(type: 'start' | 'end' | 'goal') {
  // Keep creation dialog mounted so TourForm state is preserved; it collapses
  // itself based on isPickingLocation.
  pendingPickType.value = type
  mapStore.setPickingLocation(true)
}

function handleInfoSheetPickPoint(type: 'start' | 'end' | 'goal') {
  isPickingForEdit.value = true
  pendingPickType.value = type
  mapStore.setPickingLocation(true)
}

function handlePointConsumed() {
  editPickedPoint.value = null
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
// A stale previewTourType in particular would mis-color the next tour's
// start/end markers, since they read it as a draft override.
function clearTourPreview() {
  mapStore.setPreviewGoal(null)
  mapStore.setPreviewTourType(null)
  mapStore.setPreviewStart(null)
  mapStore.setPreviewEnd(null)
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

function handleMapBackgroundClick() {
  // Suppress while location picker or region-draw is active — map panning passes
  // through the overlay and would otherwise deselect the current tour.
  if (isPickingLocation.value || isDrawingRegion.value)
    return
  closeOverlay()
}

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
  if (barState.value.addTourAction === 'pick') {
    mapStore.selectTour(null)
    mapStore.setPickingLocation(true)
  }
}

function handleListSheetAddTour() {
  closeOverlay()
  mapStore.setPickingLocation(true)
}

async function handleTourCreated(
  draft: TourDraft,
  _gpxRemoved: boolean,
  preUploadedTourId: string | null = null,
  draftId: string = '',
) {
  if (!pendingLocation.value)
    return
  // Capture goal before closeOverlay resets state
  const goal = pendingLocation.value
  closeOverlay()
  // closeOverlay() cleared the draft via resetTourCreationState; re-assert it so the
  // colored draft survives the create round-trip until performCreate swaps in the real marker.
  mapStore.setPreviewGoal(goal)
  mapStore.setPreviewTourType(draft.tourType)
  await performCreate(draft, goal, preUploadedTourId, draftId)
}

async function performCreate(
  draft: TourDraft,
  goal: { lng: number, lat: number },
  preUploadedTourId: string | null,
  draftId: string,
) {
  // Keep the re-asserted draft marker on screen through the round-trip; clear it in
  // `finally` so the real marker replaces it on success and no draft lingers on failure.
  try {
    const newId = await toursStore.createTourFromDraft(draft, goal, preUploadedTourId)
    if (newId) {
      mapStore.selectTour(newId)
      // Upload staged attachments now that the tour row exists
      if (draftId)
        await attachmentsStore.commitStaged(draftId, newId)
      // Fire-and-forget: Worker scans for friend-owned colliding tours and dispatches
      // tour_interest notifications. Replaces the legacy "decline duplicate → signal" flow.
      notifyTourInterest(newId)
    }
  }
  finally {
    clearTourPreview()
  }
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
      <OnboardingWelcome
        v-if="tourWelcome" @start="onboardingTour.startFromWelcome()"
        @skip="onboardingTour.skipWelcome()" @dismiss="onboardingTour.dismissWelcome()"
      />
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

    <TourenbuddyMap ref="mapRef" @tour-clicked="handleTourClicked" @map-background-click="handleMapBackgroundClick" />

    <MapActionOverlay
      ref="mapOverlayRef" :bearing="mapBearing" :overlay-active="activeOverlay !== null"
      @open-feedback="openOverlay('feedback')" @open-profile="openOverlay('profile')"
      @open-contacts="openOverlay('contacts')" @open-offline-map="openOverlay('offline-manage')"
      @reset-bearing="handleResetBearing" @dismiss-overlay="closeOverlay"
    />

    <TourActionBar
      :visible="barState.visible && !isDrawingRegion" :tours-disabled="barState.toursAction === 'dismiss'"
      :add-tour-disabled="barState.addTourAction === 'dismiss' || barState.addTourAction === 'disabled'"
      :add-tour-tooltip="addTourTooltip" :dismiss-mode="barState.toursAction === 'dismiss'" @tours="handleBarTours"
      @add-tour="handleBarAddTour"
    />

    <LocationPicker
      v-if="isPickingLocation" :map="mapRef?.map ?? null"
      :actions-bottom="!isDesktop && (isPickingForEdit || showTourCreationDialog) ? 80 : undefined"
      @confirm="handleLocationConfirmed" @cancel="handleLocationCancelled"
    />

    <OfflineRegionDraw
      v-if="isDrawingRegion" :map="mapRef?.map ?? null"
      @confirm="handleRegionDrawn" @cancel="handleRegionDrawCancel"
    />

    <!-- Read-only outline of the confirmed extent while the download sheet is open. -->
    <OfflineRegionOutline
      v-if="offlineBbox && activeOverlay === 'offline-download'"
      :map="mapRef?.map ?? null" :bbox="offlineBbox"
    />

    <!-- Overlays: only one visible at a time; mode="out-in" ensures the active overlay
         leaves before the incoming one enters, preventing visual stacking.
         On desktop, the container uses display:contents so fixed-position dialogs
         position themselves independently and animate via their own CSS. -->
    <Transition name="sheet" mode="out-in">
      <div v-if="selectedTour && activeOverlay === 'tour'" key="tour" ref="sheetContainerRef" class="sheet-container">
        <TourInfoSheet
          :tour="selectedTour" :edit-picked-point="editPickedPoint" :show-back="tourDetailOrigin !== null"
          :active-pick-type="isPickingForEdit ? pendingPickType : null" @close="closeOverlay" @back="handleTourInfoBack"
          @pick-point="(t: 'start' | 'end' | 'goal') => handleInfoSheetPickPoint(t)"
          @point-consumed="handlePointConsumed" @edit-mode-change="handleEditModeChange"
          @edit-contact="handleEditContact" @tour-type-change="mapStore.setPreviewTourType($event)"
          @start-point-change="handleStartPointChange" @end-point-change="handleEndPointChange"
        />
      </div>
      <div v-else-if="showFeedbackSheet" key="feedback" class="sheet-container">
        <FeedbackSheet @close="closeOverlay" />
      </div>
      <div v-else-if="showProfileSheet" key="profile" class="sheet-container">
        <UserProfileSheet @close="closeOverlay" />
      </div>
      <div v-else-if="showContactDialog" key="contacts" class="sheet-container">
        <ContactsListSheet
          :initial-contact-id="editContactId" @close="handleContactsClose"
          @open-friend-requests="handleOpenFriendRequests"
        />
      </div>
      <div v-else-if="showFriendRequests" key="friend-requests" class="sheet-container">
        <FriendRequestsSheet @close="closeOverlay" @back="openOverlay('contacts')" />
      </div>
      <div v-else-if="showToursList" key="tours" class="sheet-container">
        <TourListSheet
          @close="closeOverlay" @select-tour="handleTourSelectedFromList"
          @add-tour="handleListSheetAddTour"
        />
      </div>
      <div v-else-if="activeOverlay === 'offline-manage'" key="offline-manage" class="sheet-container">
        <OfflineManageSheet
          @close="closeOverlay" @start-draw="handleStartDrawRegion" @download-whole="handleDownloadWhole"
        />
      </div>
      <div v-else-if="activeOverlay === 'offline-download' && offlineBbox" key="offline-download" class="sheet-container">
        <OfflineDownloadSheet
          :bbox="offlineBbox" @close="handleOfflineDownloadDone" @done="handleOfflineDownloadDone"
        />
      </div>
      <div v-else-if="showTourCreationDialog" key="tour-creation" class="sheet-container">
        <TourCreationDialog
          :initial-elevation="dialogInitialElevation" :initial-name="dialogInitialName"
          :initial-start-point="dialogInitialStartPoint" :initial-end-point="dialogInitialEndPoint"
          :initial-start-point-meta="dialogInitialStartPointMeta" :initial-end-point-meta="dialogInitialEndPointMeta"
          :initial-goal="pendingLocation" :active-pick-type="pendingPickType"
          @confirm="(d, r, tid, did) => handleTourCreated(d, r, tid, did)" @close="handleDialogClose"
          @pick-point="handlePickPoint" @tour-type-change="mapStore.setPreviewTourType($event)"
          @start-point-change="handleStartPointChange" @end-point-change="handleEndPointChange"
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
.map-page--tour-locked {
  pointer-events: none;
  touch-action: none;
}

.sheet-container {
  /* fixed (not absolute) so sheets anchor to the visual viewport bottom in
     mobile browsers — sits above Android system nav and Brave bottom chrome,
     not behind it where page-root 100lvh extends. */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  /* Allow clicks to pass through transparent areas around the sheet so FABs
     remain interactive even when an overlay is open */
  pointer-events: none;
}

.calendar-feature-notice {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

/* On desktop, make the container a layout no-op so fixed-position dialogs and
   drawers position themselves relative to the viewport independently */
@media (min-width: 600px) {
  .sheet-container {
    display: contents;
  }
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}

/* On desktop, disable container transitions — each overlay animates itself */
@media (min-width: 600px) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: none;
  }

  .sheet-enter-from,
  .sheet-leave-to {
    transform: none;
  }
}
</style>
