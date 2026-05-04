<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import FeedbackSheet from '@/core/components/feedback-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import FriendRequestsSheet from '@/features/friendships/presentation/components/friend-requests-sheet.vue'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'
import MapActionOverlay from '@/features/map/presentation/components/map-action-overlay.vue'
import TourenbuddyMap from '@/features/map/presentation/components/tourenbuddy-map.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { getElevation } from '@/features/tours/data/services/swisstopo-elevation-service'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'
import { isSameGoal } from '@/features/tours/domain/distance'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'
import TourListSheet from '@/features/tours/presentation/components/tour-list-sheet.vue'
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

const mapStore = useMapStore()
const toursStore = useToursStore()
const contactsStore = useContactsStore()
const userProfileStore = useUserProfileStore()
const isDesktop = useIsDesktop()

const { isPickingLocation, selectedTourId } = storeToRefs(mapStore)
const { tours } = storeToRefs(toursStore)

const mapRef = ref<InstanceType<typeof TourenbuddyMap> | null>(null)
const mapBearing = ref(0)

// Single source of truth for which overlay is open (at most one at a time)
const activeOverlay = ref<OverlayName | null>(null)

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

// Derived reactively from store so it updates immediately when tours are mutated
const selectedTour = computed(() => tours.value.find(t => t.id === selectedTourId.value) ?? null)
const sheetContainerRef = ref<HTMLElement | null>(null)

// Whether the current location pick was triggered from the info sheet edit mode
const isPickingForEdit = ref(false)

// Set when flyToSelectedTour is called before sheetContainerRef has mounted
const pendingFlyTo = ref(false)

// Whether the tour info sheet was opened by selecting a row from the tours list
const tourOpenedFromList = ref(false)

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
}

/** Opens an overlay, closing any previously open overlay first. */
function openOverlay(name: OverlayName) {
  if (activeOverlay.value === name)
    return
  if (activeOverlay.value === 'tour' && name !== 'tour') {
    mapStore.selectTour(null)
    mapStore.setEditPreviewGoal(null)
    tourOpenedFromList.value = false
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
    mapStore.setEditPreviewGoal(null)
    tourOpenedFromList.value = false
  }
  if (activeOverlay.value === 'tour-creation') {
    resetTourCreationState()
  }
  activeOverlay.value = null
}

function handleTourSelectedFromList(tourId: string) {
  tourOpenedFromList.value = true
  mapStore.selectTour(tourId)
  openOverlay('tour')
}

function handleTourInfoBack() {
  tourOpenedFromList.value = false
  mapStore.selectTour(null)
  mapStore.setEditPreviewGoal(null)
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

onMounted(async () => {
  await Promise.all([
    toursStore.loadTours(),
    contactsStore.loadContacts(),
    userProfileStore.loadProfile(),
  ])
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
      // Show the tentative goal as an orange preview marker until edit mode closes
      mapStore.setEditPreviewGoal(location)
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
    // Cancel/save: drop preview and recenter on the (possibly updated) tour goal
    mapStore.setEditPreviewGoal(null)
    await flyToSelectedTour()
  }
}

function handleMapBackgroundClick() {
  // Suppress while location picker is active — map panning passes through the
  // pointer-events:none overlay and would otherwise deselect the current tour.
  if (isPickingLocation.value)
    return
  closeOverlay()
}

async function handleTourCreated(draft: TourDraft, gpxFile: File | null, _gpxRemoved: boolean, preUploadedTourId: string | null = null) {
  if (!pendingLocation.value)
    return
  // Capture goal before closeOverlay resets state
  const goal = pendingLocation.value
  closeOverlay()

  const newId = await toursStore.createTourFromDraft(draft, goal, gpxFile, preUploadedTourId)
  if (newId)
    mapStore.selectTour(newId)
}

function handleDialogClose() {
  closeOverlay()
}
</script>

<template>
  <div class="map-page">
    <TourenbuddyMap
      ref="mapRef"
      @tour-clicked="handleTourClicked"
      @map-background-click="handleMapBackgroundClick"
    />

    <MapActionOverlay
      :bearing="mapBearing"
      @open-feedback="openOverlay('feedback')"
      @open-profile="openOverlay('profile')"
      @open-contacts="openOverlay('contacts')"
      @open-tours="openOverlay('tours')"
      @reset-bearing="handleResetBearing"
    />

    <LocationPicker
      v-if="isPickingLocation"
      :map="mapRef?.map ?? null"
      :actions-bottom="!isDesktop && (isPickingForEdit || showTourCreationDialog) ? 80 : undefined"
      @confirm="handleLocationConfirmed"
      @cancel="handleLocationCancelled"
    />

    <!-- Overlays: only one visible at a time; mode="out-in" ensures the active overlay
         leaves before the incoming one enters, preventing visual stacking.
         On desktop, the container uses display:contents so fixed-position dialogs
         position themselves independently and animate via their own CSS. -->
    <Transition name="sheet" mode="out-in">
      <div
        v-if="selectedTour && activeOverlay === 'tour'"
        key="tour"
        ref="sheetContainerRef"
        class="sheet-container"
      >
        <TourInfoSheet
          :tour="selectedTour"
          :edit-picked-point="editPickedPoint"
          :show-back="tourOpenedFromList"
          :active-pick-type="isPickingForEdit ? pendingPickType : null"
          @close="closeOverlay"
          @back="handleTourInfoBack"
          @pick-point="(t: 'start' | 'end' | 'goal') => handleInfoSheetPickPoint(t)"
          @point-consumed="handlePointConsumed"
          @edit-mode-change="handleEditModeChange"
          @edit-contact="handleEditContact"
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
          :initial-contact-id="editContactId"
          @close="handleContactsClose"
          @open-friend-requests="handleOpenFriendRequests"
        />
      </div>
      <div v-else-if="showFriendRequests" key="friend-requests" class="sheet-container">
        <FriendRequestsSheet @close="closeOverlay" @back="openOverlay('contacts')" />
      </div>
      <div v-else-if="showToursList" key="tours" class="sheet-container">
        <TourListSheet @close="closeOverlay" @select-tour="handleTourSelectedFromList" />
      </div>
      <div v-else-if="showTourCreationDialog" key="tour-creation" class="sheet-container">
        <TourCreationDialog
          :initial-elevation="dialogInitialElevation"
          :initial-name="dialogInitialName"
          :initial-start-point="dialogInitialStartPoint"
          :initial-end-point="dialogInitialEndPoint"
          :initial-start-point-meta="dialogInitialStartPointMeta"
          :initial-end-point-meta="dialogInitialEndPointMeta"
          :initial-goal="pendingLocation"
          :active-pick-type="pendingPickType"
          @confirm="(d, f, r, tid) => handleTourCreated(d, f, r, tid)"
          @close="handleDialogClose"
          @pick-point="handlePickPoint"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.sheet-container {
  position: absolute;
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
