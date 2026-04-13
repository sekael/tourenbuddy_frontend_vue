<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, ref, watch } from 'vue'
import FeedbackSheet from '@/core/components/feedback-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'
import MapActionOverlay from '@/features/map/presentation/components/map-action-overlay.vue'
import TourenbuddyMap from '@/features/map/presentation/components/tourenbuddy-map.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import UserProfileSheet from '@/features/user/presentation/components/user-profile-sheet.vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

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
const pendingLocation = ref<{ lng: number; lat: number } | null>(null)

const selectedTour = ref<(typeof tours.value)[0] | null>(null)
const sheetContainerRef = ref<HTMLElement | null>(null)

onMounted(async () => {
  await Promise.all([
    toursStore.loadTours(),
    contactsStore.loadContacts(),
    userProfileStore.loadProfile(),
  ])
})

watch(selectedTourId, async (id) => {
  if (id) {
    selectedTour.value = tours.value.find((t) => t.id === id) ?? null
    if (selectedTour.value) {
      // Wait for the sheet/drawer to render so we can offset the camera.
      // On mobile: pad bottom by sheet height so the marker stays above the sheet.
      // On desktop: pad right by drawer width so the marker stays in the visible map area.
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
  } else {
    selectedTour.value = null
  }
})

function handleTourClicked(tourId: string) {
  mapStore.selectTour(tourId)
}

function handleLocationConfirmed(location: { lng: number; lat: number }) {
  pendingLocation.value = location
  mapStore.setPickingLocation(false)
  showTourCreationDialog.value = true
}

function handleLocationCancelled() {
  mapStore.setPickingLocation(false)
}

function closeTourInfo() {
  mapStore.selectTour(null)
}

// Called when the user taps the map background (outside any tour marker).
// NOTE: Any new modal bottom sheet added to this page MUST also be closed here.
function handleMapBackgroundClick() {
  mapStore.selectTour(null)
  showFeedbackSheet.value = false
  showProfileSheet.value = false
  showContactDialog.value = false
}

async function handleTourCreated(draft: TourDraft) {
  if (!pendingLocation.value) return
  showTourCreationDialog.value = false
  await toursStore.createTourFromDraft(draft, pendingLocation.value)
  pendingLocation.value = null
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
      @confirm="handleLocationConfirmed"
      @cancel="handleLocationCancelled"
    />

    <!-- Tour info sheet (mobile: slide-up, desktop: side drawer slides in from right) -->
    <Transition name="sheet">
      <div v-if="selectedTour" ref="sheetContainerRef" class="sheet-container">
        <TourInfoSheet :tour="selectedTour" @close="closeTourInfo" />
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
      @confirm="handleTourCreated"
      @close="showTourCreationDialog = false"
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
