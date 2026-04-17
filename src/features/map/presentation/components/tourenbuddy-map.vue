<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useGpxTrackLayer } from './gpx-track-layer'
import { TOUR_LAYER_IDS, useToursMarkerLayer } from './tours-marker-layer'
import 'maplibre-gl/dist/maplibre-gl.css'

const emit = defineEmits<{
  tourClicked: [tourId: string]
  mapBackgroundClick: []
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: MapLibreMap | null = null

const toursStore = useToursStore()
const mapStore = useMapStore()
const { tours } = storeToRefs(toursStore)
const { currentStyleIndex, selectedTourId, editPreviewGoal } = storeToRefs(mapStore)

// Expose map instance for location picker
const map = ref<MapLibreMap | null>(null)
defineExpose({ map })

let markerLayer: ReturnType<typeof useToursMarkerLayer> | null = null
let gpxLayer: ReturnType<typeof useGpxTrackLayer> | null = null

const selectedTour = computed(() => tours.value.find(t => t.id === selectedTourId.value) ?? null)

onMounted(() => {
  if (!mapContainer.value)
    return

  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style: SWISSTOPO_STYLES[0]!.style,
    center: [8.2, 46.8],
    zoom: 8,
  })

  map.value = mapInstance

  mapInstance.on('load', async () => {
    markerLayer = useToursMarkerLayer(mapInstance!, (tourId) => {
      emit('tourClicked', tourId)
    })
    await markerLayer.setup()
    markerLayer.updateTours(tours.value, selectedTourId.value)
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

onUnmounted(() => {
  mapInstance?.remove()
  mapInstance = null
  map.value = null
})

// Watch for tour/selection changes and update both layers
watch([tours, selectedTourId], ([newTours, newSelectedId]) => {
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
    mapInstance.setStyle(style.style)
    mapInstance.once('style.load', async () => {
      await markerLayer?.setup()
      markerLayer?.updateTours(tours.value, selectedTourId.value)
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
