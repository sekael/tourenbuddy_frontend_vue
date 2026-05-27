<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import {
  friendTourIdsShadowedByOwned,
  ownedTourIdsShadowedByFriends,
} from '@/features/tours/domain/collision'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useGpxTrackLayer } from './gpx-track-layer'
import { TOUR_LAYER_IDS, useToursMarkerLayer } from './tours-marker-layer'
import 'maplibre-gl/dist/maplibre-gl.css'

const emit = defineEmits<{
  tourClicked: [tourId: string]
  mapBackgroundClick: []
}>()

const { t } = useI18n({ useScope: 'global' })

const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: MapLibreMap | null = null

const toursStore = useToursStore()
const mapStore = useMapStore()
const { tours, friendTours } = storeToRefs(toursStore)
const { currentStyleIndex, selectedTourId, editPreviewGoal } = storeToRefs(mapStore)

// Expose map instance for location picker
const map = ref<MapLibreMap | null>(null)
defineExpose({ map })

let markerLayer: ReturnType<typeof useToursMarkerLayer> | null = null
let gpxLayer: ReturnType<typeof useGpxTrackLayer> | null = null

// The map shows the user's own tours plus ALL friend tours (partner and
// non-partner alike) — every tour a friend shares gets a marker. A friend tour
// colliding (within 100m) with an owned tour is suppressed — owned tours take
// precedence — but stays untouched in the Friends list.
const mapTours = computed(() => {
  const shadowed = friendTourIdsShadowedByOwned(tours.value, friendTours.value)
  const hiddenOwned = new Set<string>()

  // When a friend tour is the active selection, it overrides owned precedence at
  // its location: un-shadow it AND hide the owned tour(s) it collides with, so
  // only the friend marker + GPX show (no co-located cluster) until deselected.
  const selectedFriend = selectedTourId.value
    ? friendTours.value.find(t => t.id === selectedTourId.value)
    : undefined
  if (selectedFriend) {
    shadowed.delete(selectedFriend.id)
    for (const id of ownedTourIdsShadowedByFriends(tours.value, [selectedFriend]))
      hiddenOwned.add(id)
  }

  return [
    ...tours.value.filter(t => !hiddenOwned.has(t.id)),
    ...friendTours.value.filter(t => !shadowed.has(t.id)),
  ]
})

const selectedTour = computed(
  () => mapTours.value.find(t => t.id === selectedTourId.value) ?? null,
)

onMounted(() => {
  if (!mapContainer.value)
    return

  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style: SWISSTOPO_STYLES[0]!.style,
    center: [8.2, 46.8],
    zoom: 8,
    minZoom: 5.8,
    renderWorldCopies: false,
  })

  map.value = mapInstance
  window.visualViewport?.addEventListener('resize', onVisualViewportResize)

  mapInstance.on('load', async () => {
    markerLayer = useToursMarkerLayer(
      mapInstance!,
      (tourId) => {
        emit('tourClicked', tourId)
      },
      count => t('map.cluster.label', { count }),
      () => t('map.cluster.spiderfyHint'),
    )
    await markerLayer.setup()
    markerLayer.updateTours(mapTours.value, selectedTourId.value)
    markerLayer.updatePreview(editPreviewGoal.value, selectedTour.value?.tourType ?? null)

    gpxLayer = useGpxTrackLayer(mapInstance!)
    gpxLayer.setup()
    gpxLayer.updateTrack(selectedTour.value)

    mapInstance!.on('click', (e) => {
      const hits = mapInstance!.queryRenderedFeatures(e.point, {
        layers: [...TOUR_LAYER_IDS],
      })
      if (hits.length === 0) {
        emit('mapBackgroundClick')
      }
    })
  })
})

// Resize canvas when the visual viewport changes (virtual keyboard open/close,
// or dynamic-viewport height recalculation on iOS PWA).
function onVisualViewportResize() {
  mapInstance?.resize()
}

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onVisualViewportResize)
  markerLayer?.cleanup()
  mapInstance?.remove()
  mapInstance = null
  map.value = null
})

// Watch for tour/selection changes and update both layers
watch([mapTours, selectedTourId], ([newTours, newSelectedId]) => {
  markerLayer?.updateTours(newTours, newSelectedId)
  gpxLayer?.updateTrack(selectedTour.value)
})

// Watch for edit preview goal changes and update the preview marker
watch(editPreviewGoal, (goal) => {
  markerLayer?.updatePreview(goal, selectedTour.value?.tourType ?? null)
})

// Watch for map style changes
watch(currentStyleIndex, (index) => {
  if (!mapInstance)
    return
  const style = SWISSTOPO_STYLES[index]
  if (style) {
    markerLayer?.cleanup()
    mapInstance.setStyle(style.style)
    mapInstance.once('style.load', async () => {
      await markerLayer?.setup()
      markerLayer?.updateTours(mapTours.value, selectedTourId.value)
      markerLayer?.updatePreview(editPreviewGoal.value, selectedTour.value?.tourType ?? null)
      gpxLayer?.setup()
      gpxLayer?.updateTrack(selectedTour.value)
    })
  }
})
</script>

<template>
  <div ref="mapContainer" class="map-container" />
</template>

<style scoped>
.map-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
