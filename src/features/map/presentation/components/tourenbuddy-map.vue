<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import {
  friendTourIdsShadowedByOwned,
  ownedTourIdsShadowedByFriends,
} from '@/features/tours/domain/collision'
import { tourDetailMarkers } from '@/features/tours/domain/tour-detail-markers'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useGpxTrackLayer } from './gpx-track-layer'
import { DETAIL_CIRCLE_LAYER_ID, TOUR_LAYER_IDS, useToursMarkerLayer } from './tours-marker-layer'
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
const tourLinksStore = useTourLinksStore()
const { tours, friendTours } = storeToRefs(toursStore)
const { currentStyleIndex, selectedTourId, previewGoal, previewTourType, previewStart, previewEnd }
  = storeToRefs(mapStore)
const { groupIdByTourId } = storeToRefs(tourLinksStore)

const linkedTourIds = computed(() => new Set(groupIdByTourId.value.keys()))

// Expose map instance for location picker
const map = ref<MapLibreMap | null>(null)
defineExpose({ map })

let markerLayer: ReturnType<typeof useToursMarkerLayer> | null = null
let gpxLayer: ReturnType<typeof useGpxTrackLayer> | null = null

// The map shows the user's own tours plus only the friend tours the user is a
// partner on — non-partner friend tours never get a marker (the Friends list
// still shows every shared tour). A partner friend tour colliding (within 100m)
// with an owned tour is suppressed — owned tours take precedence.
const mapTours = computed(() => {
  const partnerFriendTours = friendTours.value.filter(t => t.isPartner === true)
  const shadowed = friendTourIdsShadowedByOwned(tours.value, partnerFriendTours)
  const hiddenOwned = new Set<string>()

  // When a partner friend tour is the active selection, it overrides owned
  // precedence at its location: un-shadow it AND hide the owned tour(s) it
  // collides with, so only the friend marker + GPX show (no co-located cluster)
  // until deselected.
  const selectedFriend = selectedTourId.value
    ? partnerFriendTours.find(t => t.id === selectedTourId.value)
    : undefined
  if (selectedFriend) {
    shadowed.delete(selectedFriend.id)
    for (const id of ownedTourIdsShadowedByFriends(tours.value, [selectedFriend]))
      hiddenOwned.add(id)
  }

  return [
    ...tours.value.filter(t => !hiddenOwned.has(t.id)),
    ...partnerFriendTours.filter(t => !shadowed.has(t.id)),
  ]
})

const selectedTour = computed(
  () => mapTours.value.find(t => t.id === selectedTourId.value) ?? null,
)

// Tours as fed to the marker layer. Identical to `mapTours`, except while a
// selected tour's type is being edited: the goal's color is data-driven off the
// `tourType` property, so the only way to preview the draft type is to feed the
// layer a copy of the selected tour carrying `previewTourType`. (The saved
// start/end markers already recolor live because their data reads it directly.)
const renderedTours = computed(() => {
  if (previewTourType.value === null || selectedTourId.value === null) {
    return mapTours.value
  }
  return mapTours.value.map(t => t.id === selectedTourId.value ? { ...t, tourType: previewTourType.value } : t)
})

// Start/end detail markers for the open or in-creation tour. When a tour is
// selected, saved coords with per-point draft overrides; during creation (no
// selected tour) the preview refs alone drive them. Empty on the bare map.
const detailMarkers = computed(() => {
  const tour = selectedTour.value
  return tourDetailMarkers({
    tourType: previewTourType.value ?? tour?.tourType ?? null,
    start: { saved: tour?.startPoint ?? null, draft: previewStart.value },
    end: { saved: tour?.endPoint ?? null, draft: previewEnd.value },
  })
})

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
    markerLayer.updateTours(renderedTours.value, selectedTourId.value, linkedTourIds.value)
    markerLayer.updatePreview(previewGoal.value, previewTourType.value)
    markerLayer.updateDetailMarkers(detailMarkers.value)

    gpxLayer = useGpxTrackLayer(mapInstance!)
    gpxLayer.setup()
    gpxLayer.updateTrack(selectedTour.value)

    mapInstance!.on('click', (e) => {
      // Include the detail circle so tapping a start/end marker is swallowed
      // (no select, no dismiss) rather than read as a background click.
      const layers = [...TOUR_LAYER_IDS]
      if (mapInstance!.getLayer(DETAIL_CIRCLE_LAYER_ID))
        layers.push(DETAIL_CIRCLE_LAYER_ID)
      const hits = mapInstance!.queryRenderedFeatures(e.point, { layers })
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

// Watch for tour/selection changes and update both layers. Keyed on
// `renderedTours` (not `mapTours`) so a live tour-type edit recolors the goal.
watch([renderedTours, selectedTourId, linkedTourIds], ([newTours, newSelectedId, newLinked]) => {
  markerLayer?.updateTours(newTours, newSelectedId, newLinked as Set<string>)
  gpxLayer?.updateTrack(selectedTour.value)
})

// Watch for preview goal/type changes (edit or creation) and update the preview marker
watch([previewGoal, previewTourType], ([goal, tourType]) => {
  markerLayer?.updatePreview(goal, tourType)
})

// Re-render start/end detail markers whenever the open tour or its draft points change
watch(detailMarkers, (markers) => {
  markerLayer?.updateDetailMarkers(markers)
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
      markerLayer?.updateTours(renderedTours.value, selectedTourId.value, linkedTourIds.value)
      markerLayer?.updatePreview(previewGoal.value, previewTourType.value)
      markerLayer?.updateDetailMarkers(detailMarkers.value)
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
