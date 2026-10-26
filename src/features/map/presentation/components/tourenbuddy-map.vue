<script setup lang="ts">
import type { LngLat, Map as MapLibreMap, PaddingOptions, Point } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import maplibregl from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormatter } from '@/core/composables/use-formatter'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { TRAIL_OVERLAYS } from '@/features/map/data/trail-overlays'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import {
  friendTourIdsShadowedByOwned,
  ownedTourIdsShadowedByFriends,
} from '@/features/tours/domain/collision'
import { outingChains as outingChainsOf, outingKey, outingSegments } from '@/features/tours/domain/outing'
import { outingDetailMarkers, tourDetailMarkers } from '@/features/tours/domain/tour-detail-markers'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useGpxTrackLayer } from './gpx-track-layer'
import { DETAIL_CIRCLE_LAYER_ID, TOUR_LAYER_IDS, useToursMarkerLayer } from './tours-marker-layer'
import { useTrailLayers } from './trail-layers'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{
  /** The map area an open drawer or sheet covers: cluster taps frame beside it. */
  covered?: Partial<PaddingOptions>
}>()

const emit = defineEmits<{
  tourClicked: [tourId: string]
  mapBackgroundClick: [tap: { point: Point, lngLat: LngLat }]
}>()

const { t, locale } = useI18n({ useScope: 'global' })
const { formatDateRange, formatElevation } = useFormatter()

const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: MapLibreMap | null = null

const toursStore = useToursStore()
const mapStore = useMapStore()
const tourLinksStore = useTourLinksStore()
const { tours, friendTours } = storeToRefs(toursStore)
const {
  currentStyleIndex,
  selectedTourId,
  selectedOutingKey,
  previewGoal,
  previewTourTypes,
  previewStart,
  previewEnd,
  activeOverlays,
  trailCard,
} = storeToRefs(mapStore)
const { groupIdByTourId } = storeToRefs(tourLinksStore)

const linkedTourIds = computed(() => new Set(groupIdByTourId.value.keys()))

// Expose map instance for location picker
const map = ref<MapLibreMap | null>(null)
defineExpose({ map })

let markerLayer: ReturnType<typeof useToursMarkerLayer> | null = null
let gpxLayer: ReturnType<typeof useGpxTrackLayer> | null = null
let trailLayers: ReturnType<typeof useTrailLayers> | null = null

// Map-layers panel previews: fetched + decoded once the first tiles are in, and held
// here so the browser keeps them in its memory cache — the panel then opens with its
// thumbnails already painted instead of popping them in.
const layerThumbnails: HTMLImageElement[] = []
function preloadLayerThumbnails() {
  layerThumbnails.push(...[...SWISSTOPO_STYLES, ...TRAIL_OVERLAYS].map(({ thumbnail }) => {
    const img = new Image()
    img.src = thumbnail
    img.decode().catch(() => {}) // best effort: the panel still loads it on open
    return img
  }))
}

// The map shows the user's own tours plus only the friend tours the user is a
// partner on — non-partner friend tours never get a marker (the Friends list
// still shows every shared tour). A partner friend tour colliding (COLLISION_RADIUS_M)
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

// The open overview's segments, in order (#338, D16). An open segment is a plain tour on the
// map — only its own markers and track. Empty too when fewer than two segments are on the map.
const focusSegments = computed(() => outingSegments(mapTours.value, selectedOutingKey.value))
const focusSegmentIds = computed(() => focusSegments.value.map(t => t.id))

// Every overview segment's track or connector; else just the selected tour's.
const trackTours = computed(() =>
  focusSegments.value.length > 0 ? focusSegments.value : selectedTour.value ? [selectedTour.value] : [],
)

// Tours as fed to the marker layer. Identical to `mapTours`, except while a
// selected tour's types are being edited: the goal's color is data-driven off its
// types, so the only way to preview the draft types is to feed the layer a copy of
// the selected tour carrying `previewTourTypes`. (The saved
// start/end markers already recolor live because their data reads it directly.)
const renderedTours = computed(() => {
  if (previewTourTypes.value === null || selectedTourId.value === null) {
    return mapTours.value
  }
  const tourTypes = previewTourTypes.value
  return mapTours.value.map(t => t.id === selectedTourId.value ? { ...t, tourTypes } : t)
})

// Start/end detail markers for the open or in-creation tour. When a tour is
// selected, saved coords with per-point draft overrides; during creation (no
// selected tour) the preview refs alone drive them. Empty on the bare map.
const detailMarkers = computed(() => {
  const tour = selectedTour.value
  // The outing overview (no segment open): the whole outing's start and end.
  if (!tour && focusSegments.value.length > 0 && !previewStart.value && !previewEnd.value)
    return outingDetailMarkers(focusSegments.value)
  return tourDetailMarkers({
    tourTypes: previewTourTypes.value ?? tour?.tourTypes ?? [],
    start: { saved: tour?.startPoint ?? null, draft: previewStart.value },
    end: { saved: tour?.endPoint ?? null, draft: previewEnd.value },
  })
})

/** Each outing segment's place in its outing, for its label ("Etappe 2/3"). */
const stageOf = computed(() => {
  const stages = new Map<string, { n: number, total: number }>()
  for (const key of new Set(mapTours.value.map(outingKey).filter(k => k !== null))) {
    const segments = outingSegments(mapTours.value, key)
    segments.forEach((s, i) => stages.set(s.id, { n: i + 1, total: segments.length }))
  }
  return stages
})

/** Label lines (D4): the name, then elevation · date — or "no date" / "done". */
function describeTour(tour: Tour) {
  const thisYear = new Date().getFullYear()
  const start = tour.plannedDate
  const status = tour.completed
    ? t('map.marker.done')
    : start
      ? formatDateRange.value(start, tour.endDate ?? start, {
          day: 'numeric',
          month: 'short',
          ...(start.getFullYear() !== thisYear ? { year: 'numeric' } : {}),
        })
      : t('map.marker.noDate')
  const stage = stageOf.value.get(tour.id)
  return {
    name: tour.name || t('tours.infoSheet.unnamedTour'),
    sub: [
      stage ? t('map.marker.stage', stage) : null,
      tour.elevation ? formatElevation.value(tour.elevation) : null,
      status,
    ].filter(Boolean).join(' · '),
  }
}

// Each outing on the map as a chain of goals (D8) — none while a tour or outing is open: the map
// shows only that (D15), and the open overview has its tracks.
const outingChains = computed(() => selectedTour.value || focusSegments.value.length > 0
  ? []
  : outingChainsOf(mapTours.value, selectedOutingKey.value))

const detailLabels = computed(() => ({ start: t('tours.form.startPointLabel'), end: t('tours.form.endPointLabel') }))

/** Who has the map (D15): the open tour, else the open outing's segments. A change swaps the scene (D20). */
const scene = computed(() => `${selectedTour.value?.id ?? ''}/${focusSegmentIds.value.join()}`)
/** The scene last drawn; until a swap draws the new one, updates for it wait (they'd show early). */
let drawnScene: string | null = null

function drawScene() {
  drawnScene = scene.value
  markerLayer?.updateTours(renderedTours.value, selectedTourId.value, linkedTourIds.value, focusSegmentIds.value)
  markerLayer?.updateDetailMarkers(detailMarkers.value, detailLabels.value)
  markerLayer?.updateOutingChains(outingChains.value)
  void gpxLayer?.updateTracks(trackTours.value)
}

/**
 * Swisstopo draws landmark summits (Eiger, Piz Bernina, …) as navy discs that both reviews took
 * for tour markers; give them the plain summit symbol the base map uses for every other peak.
 * Names and heights stay. A no-op on the raster style, which has no such layer.
 */
function calmLandmarkPeaks(m: MapLibreMap) {
  if (!m.getLayer('peak_lm'))
    return
  m.setLayoutProperty('peak_lm', 'icon-image', 'mountain')
  m.setLayoutProperty('peak_lm', 'icon-size', ['interpolate', ['linear'], ['zoom'], 13, 0.25, 18, 0.55])
}

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
    preloadLayerThumbnails()
    calmLandmarkPeaks(mapInstance!)
    // First: the overlay stack must sit below everything added after it.
    trailLayers = useTrailLayers(mapInstance!)
    trailLayers.setup(trailLayerState())

    markerLayer = useToursMarkerLayer(
      mapInstance!,
      (tourId) => {
        emit('tourClicked', tourId)
      },
      count => t('map.cluster.label', { count }),
      {
        describeTour,
        stackTitle: count => t('map.marker.stackTitle', { count }),
        stackMore: count => t('map.marker.stackMore', { count }),
        clusterSummary: ({ total, planned, undated, done }) => [
          t('map.cluster.label', { count: total }),
          ...([['planned', planned], ['undated', undated], ['done', done]] as const)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => t(`map.cluster.${key}`, { count })),
        ].join(' · '),
        closeLabel: t('map.marker.close'),
      },
      () => props.covered ?? {},
    )
    await markerLayer.setup()
    markerLayer.updatePreview(previewGoal.value, previewTourTypes.value ?? [])
    gpxLayer = useGpxTrackLayer(mapInstance!)
    gpxLayer.setup()
    drawScene()

    mapInstance!.on('click', (e) => {
      // Include the detail circle so tapping a start/end marker is swallowed
      // (no select, no dismiss) rather than read as a background click.
      const layers: string[] = [...TOUR_LAYER_IDS]
      if (mapInstance!.getLayer(DETAIL_CIRCLE_LAYER_ID))
        layers.push(DETAIL_CIRCLE_LAYER_ID)
      const hits = mapInstance!.queryRenderedFeatures(e.point, { layers })
      if (hits.length === 0) {
        emit('mapBackgroundClick', { point: e.point, lngLat: e.lngLat })
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
  layerThumbnails.length = 0
  markerLayer?.cleanup()
  mapInstance?.remove()
  mapInstance = null
  map.value = null
})

watch(scene, () => markerLayer?.swapScene(drawScene, visible => gpxLayer?.setVisible(visible)))

// Changes within the drawn scene apply at once. Keyed on `renderedTours` (not `mapTours`) so a
// live tour-type edit recolors the goal.
const inDrawnScene = () => scene.value === drawnScene
watch([renderedTours, selectedTourId, linkedTourIds, focusSegmentIds, locale], ([newTours, newSelectedId, newLinked, segmentIds]) => {
  if (inDrawnScene())
    markerLayer?.updateTours(newTours, newSelectedId, newLinked as Set<string>, segmentIds)
})
watch(trackTours, (entries) => {
  if (inDrawnScene())
    void gpxLayer?.updateTracks(entries)
})

// Watch for preview goal/type changes (edit or creation) and update the preview marker
watch([previewGoal, previewTourTypes], ([goal, tourTypes]) => {
  markerLayer?.updatePreview(goal, tourTypes ?? [])
})

// Re-render start/end detail markers whenever the open tour or its draft points change
watch([detailMarkers, detailLabels], ([markers, labels]) => {
  if (inDrawnScene())
    markerLayer?.updateDetailMarkers(markers, labels)
})
watch(outingChains, (chains) => {
  if (inDrawnScene())
    markerLayer?.updateOutingChains(chains)
})

watch(activeOverlays, ids => trailLayers?.setVisible(ids))
watch(trailCard, card => trailLayers?.setHighlight(card))
/** Swisstopo's difficulty fields are per language: `de-CH` → `de`. */
const badgeLang = computed(() => locale.value.split('-')[0]!)
watch(badgeLang, lang => trailLayers?.setLang(lang))

function trailLayerState() {
  return { active: activeOverlays.value, lang: badgeLang.value, card: trailCard.value }
}

// Watch for map style changes
watch(currentStyleIndex, (index) => {
  if (!mapInstance)
    return
  const style = SWISSTOPO_STYLES[index]
  if (style) {
    markerLayer?.cleanup()
    mapInstance.setStyle(style.style)
    mapInstance.once('style.load', async () => {
      calmLandmarkPeaks(mapInstance!)
      trailLayers?.setup(trailLayerState())
      await markerLayer?.setup()
      markerLayer?.updatePreview(previewGoal.value, previewTourTypes.value ?? [])
      gpxLayer?.setup()
      drawScene()
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

<style>
/* A scene change (D20) fades the DOM clusters and chip with the GL markers. */
.tours-scene-hidden .maplibregl-marker {
  opacity: 0 !important;
  pointer-events: none;
}

/* Stack list (design D7): built as plain DOM by the marker layer inside a MapLibre popup, so it
   can't take scoped styles. */
.stack-list-popup .maplibregl-popup-content {
  padding: var(--spacing-xs) 0;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-family-base);
}

.stack-list-popup .maplibregl-popup-close-button {
  width: 32px;
  height: 32px;
  font-size: 20px;
  color: var(--color-on-surface-variant);
}

.stack-list-popup--above .stack-list__rows {
  /* Opened upward above a tour: about the room above it when framed, under the title. */
  max-height: min(38vh, 360px);
}

.stack-list__title {
  margin: 0;
  padding: var(--spacing-xxs) 40px var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.stack-list__rows {
  /* The marker layer pans the list into view when it runs off the visible area. */
  max-height: min(55vh, 440px);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  /* Scroll shadows: a soft edge shows only where more rows hide (local covers vs. fixed shades). */
  background:
    linear-gradient(var(--white) 30%, transparent) center top / 100% 32px no-repeat local,
    linear-gradient(transparent, var(--white) 70%) center bottom / 100% 32px no-repeat local,
    radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.18), transparent) center top / 100% 10px no-repeat scroll,
    radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.18), transparent) center bottom / 100% 10px no-repeat
      scroll;
}

.stack-list__row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--color-on-surface);

  &:hover,
  &:focus-visible {
    background: var(--color-neutral-container);
  }
}

.stack-list__dot {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border: 2px solid var(--white);
  border-radius: var(--radius-round);
  box-shadow: var(--shadow-control);

  & img {
    width: 16px;
    height: 16px;
  }

  &[data-completed]::after {
    content: '';
    position: absolute;
    right: -4px;
    bottom: -4px;
    width: 11px;
    height: 11px;
    border: 1.5px solid var(--white);
    border-radius: var(--radius-round);
    background: #15803d
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='5,12.5 10,17.5 19.5,7' stroke='white' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
      center / 9px no-repeat;
  }
}

.stack-list__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stack-list__name {
  overflow: hidden;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stack-list__sub {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}
</style>
