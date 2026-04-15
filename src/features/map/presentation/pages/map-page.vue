<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import FeedbackSheet from '@/core/components/feedback-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'
import MapActionOverlay from '@/features/map/presentation/components/map-action-overlay.vue'
import TourenbuddyMap from '@/features/map/presentation/components/tourenbuddy-map.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { getElevation } from '@/features/tours/data/services/swisstopo-elevation-service'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import UserProfileSheet from '@/features/user/presentation/components/user-profile-sheet.vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

type PickPointType = 'goal' | 'start' | 'end'

const mapStore = useMapStore()
const toursStore = useToursStore()
const contactsStore = useContactsStore()
const userProfileStore = useUserProfileStore()
const isDesktop = useIsDesktop()

const { isPickingLocation, selectedTourId } = storeToRefs(mapStore)
const { tours } = storeToRefs(toursStore)

const mapRef = ref<InstanceType<typeof TourenbuddyMap> | null>(null)

// Dialog visibility
const showFeedbackSheet = ref(false)
const showProfileSheet = ref(false)
const showContactDialog = ref(false)
const showTourCreationDialog = ref(false)

// Location picking state
const pendingLocation = ref<{ lng: number, lat: number } | null>(null)
// 'goal' = main tour objective, 'start' = start point, 'end' = end point
const pendingPickType = ref<'goal' | 'start' | 'end'>('goal')

// Pre-fill values for the creation dialog (from Swisstopo lookups & secondary picks)
const dialogInitialElevation = ref<number | null>(null)
const dialogInitialName = ref<string | null>(null)
const dialogInitialStartPoint = ref<{ lng: number, lat: number } | null>(null)
const dialogInitialEndPoint = ref<{ lng: number, lat: number } | null>(null)

// Derived reactively from store so it updates immediately when tours are mutated
const selectedTour = computed(() => tours.value.find(t => t.id === selectedTourId.value) ?? null)
const sheetContainerRef = ref<HTMLElement | null>(null)

// Whether the current location pick was triggered from the info sheet edit mode
const isPickingForEdit = ref(false)

// Prop-based handoff to info sheet after a location pick in edit mode
const editPickedPoint = ref<{
  type: 'start' | 'end' | 'goal'
  location: { lng: number, lat: number }
  elevation?: number | null
  suggestedName?: string | null
} | null>(null)

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

watch(selectedTourId, async (id) => {
  if (id)
    await flyToSelectedTour()
})

function handleTourClicked(tourId: string) {
  mapStore.selectTour(tourId)
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
      editPickedPoint.value = { type: pickType, location }
    }
    return
  }

  if (pendingPickType.value === 'start') {
    dialogInitialStartPoint.value = location
    showTourCreationDialog.value = true
    return
  }

  if (pendingPickType.value === 'end') {
    dialogInitialEndPoint.value = location
    showTourCreationDialog.value = true
    return
  }

  // Main goal pick: fire Swisstopo lookups in parallel before showing dialog
  pendingLocation.value = location
  const [elevation, name] = await Promise.all([getElevation(location), suggestTourName(location)])
  dialogInitialElevation.value = elevation
  dialogInitialName.value = name
  showTourCreationDialog.value = true
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
  if (pendingPickType.value === 'start' || pendingPickType.value === 'end') {
    showTourCreationDialog.value = true
  }
  pendingPickType.value = 'goal'
}

function handlePickPoint(type: 'start' | 'end') {
  showTourCreationDialog.value = false
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

function closeTourInfo() {
  mapStore.setEditPreviewGoal(null)
  mapStore.selectTour(null)
}

function handleMapBackgroundClick() {
  // Suppress while location picker is active — map panning passes through the
  // pointer-events:none overlay and would otherwise deselect the current tour.
  if (isPickingLocation.value)
    return
  mapStore.selectTour(null)
  showFeedbackSheet.value = false
  showProfileSheet.value = false
  showContactDialog.value = false
}

async function handleTourCreated(draft: TourDraft) {
  if (!pendingLocation.value)
    return
  showTourCreationDialog.value = false

  // Reset dialog initial values for next tour creation
  dialogInitialElevation.value = null
  dialogInitialName.value = null
  dialogInitialStartPoint.value = null
  dialogInitialEndPoint.value = null
  pendingPickType.value = 'goal'

  await toursStore.createTourFromDraft(draft, pendingLocation.value)
  pendingLocation.value = null
}

function handleDialogClose() {
  showTourCreationDialog.value = false
  pendingLocation.value = null
  dialogInitialElevation.value = null
  dialogInitialName.value = null
  dialogInitialStartPoint.value = null
  dialogInitialEndPoint.value = null
  pendingPickType.value = 'goal'
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
      @open-feedback="showFeedbackSheet = true"
      @open-profile="showProfileSheet = true"
      @open-contacts="showContactDialog = true"
    />

    <LocationPicker
      v-if="isPickingLocation"
      :map="mapRef?.map ?? null"
      :actions-bottom="isPickingForEdit && !isDesktop ? 112 : undefined"
      @confirm="handleLocationConfirmed"
      @cancel="handleLocationCancelled"
    />

    <!-- Tour info sheet (mobile: slide-up, desktop: side drawer slides in from right) -->
    <Transition name="sheet">
      <div v-if="selectedTour" ref="sheetContainerRef" class="sheet-container">
        <TourInfoSheet
          :tour="selectedTour"
          :edit-picked-point="editPickedPoint"
          @close="closeTourInfo"
          @pick-point="(t: 'start' | 'end' | 'goal') => handleInfoSheetPickPoint(t)"
          @point-consumed="handlePointConsumed"
          @edit-mode-change="handleEditModeChange"
        />
      </div>
    </Transition>

    <!-- Feedback sheet -->
    <Transition name="sheet">
      <div v-if="showFeedbackSheet" class="sheet-container">
        <FeedbackSheet @close="showFeedbackSheet = false" />
      </div>
    </Transition>

    <!-- Tour creation dialog -->
    <TourCreationDialog
      v-if="showTourCreationDialog"
      :initial-elevation="dialogInitialElevation"
      :initial-name="dialogInitialName"
      :initial-start-point="dialogInitialStartPoint"
      :initial-end-point="dialogInitialEndPoint"
      :initial-goal="pendingLocation"
      @confirm="handleTourCreated"
      @close="handleDialogClose"
      @pick-point="handlePickPoint"
    />

    <!-- User profile sheet -->
    <Transition name="sheet">
      <div v-if="showProfileSheet" class="sheet-container">
        <UserProfileSheet @close="showProfileSheet = false" />
      </div>
    </Transition>

    <!-- Contacts list sheet -->
    <Transition name="sheet">
      <div v-if="showContactDialog" class="sheet-container">
        <ContactsListSheet @close="showContactDialog = false" />
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
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}

/* Desktop: fade transition — no transform to avoid confining the component's
   position:fixed backdrop or drawer to a new stacking context */
@media (min-width: 600px) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: opacity 0.2s ease;
  }

  .sheet-enter-from,
  .sheet-leave-to {
    transform: none;
    opacity: 0;
  }
}
</style>
