<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useToursMarkerLayer } from './tours-marker-layer'
import 'maplibre-gl/dist/maplibre-gl.css'

const emit = defineEmits<{
  tourClicked: [tourId: string]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: MapLibreMap | null = null

const toursStore = useToursStore()
const mapStore = useMapStore()
const { tours } = storeToRefs(toursStore)
const { currentStyleIndex, selectedTourId } = storeToRefs(mapStore)

// Expose map instance for location picker
const map = ref<MapLibreMap | null>(null)
defineExpose({ map })

let markerLayer: ReturnType<typeof useToursMarkerLayer> | null = null

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

  mapInstance.on('load', () => {
    markerLayer = useToursMarkerLayer(mapInstance!, (tourId) => {
      emit('tourClicked', tourId)
    })
    markerLayer.setup()
    markerLayer.updateTours(tours.value, selectedTourId.value)
  })
})

onUnmounted(() => {
  mapInstance?.remove()
  mapInstance = null
  map.value = null
})

// Watch for tour/selection changes and update the layer
watch([tours, selectedTourId], ([newTours, newSelectedId]) => {
  markerLayer?.updateTours(newTours, newSelectedId)
})

// Watch for map style changes
watch(currentStyleIndex, (index) => {
  if (!mapInstance)
    return
  const style = SWISSTOPO_STYLES[index]
  if (style) {
    mapInstance.setStyle(style.style)
    mapInstance.once('styledata', () => {
      markerLayer?.setup()
      markerLayer?.updateTours(tours.value, selectedTourId.value)
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
