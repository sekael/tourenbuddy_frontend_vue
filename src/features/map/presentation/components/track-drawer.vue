<script setup lang="ts">
import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent, Point, VectorTileSource } from 'maplibre-gl'
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import { LngLatBounds } from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { z } from 'zod'
import { SKI_ROUTES_TILEJSON } from '@/features/map/data/trail-overlays'
import { snapNetworkFor } from '@/features/map/domain/snap-network'
import { isBoundsVisible } from '@/features/map/presentation/composables/frame-tour'
import { useTrackDrawing } from '@/features/map/presentation/composables/use-track-drawing'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { estimatedMinutes } from '@/features/tours/domain/route-metrics'
import { useTrackDrawLayer } from './track-draw-layer'
import TrackDrawPanel from './track-draw-panel.vue'
import { SKI_ROUTES_SOURCE_ID } from './trail-layers'

/**
 * Draw a track on the map the way the swisstopo app does: a tap sets a point and the line runs
 * there along the trails the map shows; a point can be dragged, a tap on the start closes a loop.
 * The map stays free to pan and zoom between taps.
 */
const props = defineProps<{
  map: MapLibreMap | null
  /** The track to go on from (the form's current one), or null for a new one. */
  seed: DrawnTrack | null
  /** The form's activities: with both trail layers shown they pick which one the line follows. */
  tourTypes: readonly string[]
}>()

const emit = defineEmits<{ done: [track: DrawnTrack], cancel: [] }>()

const mapStore = useMapStore()
const { activeOverlays } = storeToRefs(mapStore)

const network = computed(() => snapNetworkFor(activeOverlays.value, props.tourTypes))
const byActivity = computed(() => activeOverlays.value.length > 1)

const skiManifest = z.object({ tiles: z.array(z.string()).min(1) })
async function skiTemplate(): Promise<string | null> {
  const fromMap = props.map?.getSource<VectorTileSource>(SKI_ROUTES_SOURCE_ID)?.tiles?.[0]
  if (fromMap)
    return fromMap
  try {
    return skiManifest.parse(await (await fetch(SKI_ROUTES_TILEJSON)).json()).tiles[0]!
  }
  catch {
    return null
  }
}

const drawing = useTrackDrawing({ seed: props.seed, network: () => network.value, skiTemplate })
const { track, shown, queued } = drawing

// The pace is the activity's: on skis when ski touring would pick the ski routes.
const minutes = computed(() => estimatedMinutes(drawing.metrics.value, snapNetworkFor(['hiking', 'ski'], props.tourTypes) === 'ski'))

// ── Gestures ────────────────────────────────────────────────────────────────
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

/** Never farther than this, however far out the map is zoomed: a point lands near where it was set. */
const MAX_SNAP_M = 250

/** A tap snaps to a way this many screen pixels away: generous, a finger covers a trail. */
function snapRadiusM(lat: number): number {
  const px = coarse() ? 32 : 16
  return Math.min(MAX_SNAP_M, px * 78271.517 * Math.cos(lat * Math.PI / 180) / 2 ** props.map!.getZoom())
}

/** The point under `at`, within fingertip reach; -1 for none. */
function pointAt(at: Point): number {
  const reach = coarse() ? 24 : 12
  let best = -1
  let bestDistance = reach
  track.value.points.forEach((p, i) => {
    const d = props.map!.project(p).dist(at)
    if (d <= bestDistance) {
      best = i
      bestDistance = d
    }
  })
  return best
}

const lngLat = (e: MapMouseEvent | MapTouchEvent): LngLat => [e.lngLat.lng, e.lngLat.lat]

function onClick(e: MapMouseEvent) {
  const hit = pointAt(e.point)
  const { points } = track.value
  // A tap on the start closes the loop; on any other point it was a grab, not a new point.
  if (hit === 0 && points.length > 1)
    drawing.add(points[0]!, snapRadiusM(points[0]![1]))
  else if (hit < 0)
    drawing.add(lngLat(e), snapRadiusM(e.lngLat.lat))
}

let drag: { index: number, from: Point, to: LngLat | null } | null = null

function onPress(e: MapMouseEvent | MapTouchEvent) {
  if ('touches' in e.originalEvent && e.originalEvent.touches.length > 1)
    return
  const index = pointAt(e.point)
  if (index < 0 || drawing.busy.value)
    return
  // Holds the map still: this gesture moves the point, not the map.
  e.preventDefault()
  drag = { index, from: e.point, to: null }
}

function onMove(e: MapMouseEvent | MapTouchEvent) {
  if (!drag) {
    if (!coarse())
      props.map!.getCanvas().style.cursor = pointAt(e.point) >= 0 ? 'grab' : 'crosshair'
    return
  }
  // Under 4 px it is a tap on the point, not a drag.
  if (!drag.to && e.point.dist(drag.from) < 4)
    return
  drag.to = lngLat(e)
  drawing.drag(drag.index, drag.to)
}

function onRelease() {
  if (drag?.to)
    drawing.drop(drag.index, drag.to, snapRadiusM(drag.to[1]))
  drag = null
}

let layer: ReturnType<typeof useTrackDrawLayer> | null = null
watch([shown, queued], ([t, q]) => layer?.update(t, q))

onMounted(() => {
  const map = props.map
  if (!map)
    return
  layer = useTrackDrawLayer(map, 'track-draw')
  layer.setup()
  layer.update(shown.value, queued.value)
  // Double-tap zoom would read as two new points.
  map.doubleClickZoom.disable()
  map.getContainer().classList.add('track-drawing')
  if (!coarse())
    map.getCanvas().style.cursor = 'crosshair'
  map.on('click', onClick)
  map.on('mousedown', onPress)
  map.on('touchstart', onPress)
  map.on('mousemove', onMove)
  map.on('touchmove', onMove)
  map.on('mouseup', onRelease)
  map.on('touchend', onRelease)
  map.on('touchcancel', onRelease)

  // A track to go on from is framed above the panel, unless it already shows there.
  const line = props.seed?.legs.flat() ?? []
  if (line.length > 1) {
    const bounds = line.reduce((b, p) => b.extend(p), new LngLatBounds(line[0], line[0]))
    const covered = { bottom: 300 }
    if (!isBoundsVisible(map, bounds, covered))
      map.fitBounds(bounds, { padding: { top: 60, left: 40, right: 40, bottom: 320 }, maxZoom: 15 })
  }
})

onBeforeUnmount(() => {
  const map = props.map
  if (!map)
    return
  map.off('click', onClick)
  map.off('mousedown', onPress)
  map.off('touchstart', onPress)
  map.off('mousemove', onMove)
  map.off('touchmove', onMove)
  map.off('mouseup', onRelease)
  map.off('touchend', onRelease)
  map.off('touchcancel', onRelease)
  map.doubleClickZoom.enable()
  map.getContainer().classList.remove('track-drawing')
  map.getCanvas().style.cursor = ''
  layer?.remove()
})
</script>

<template>
  <Teleport to="body">
    <TrackDrawPanel
      :overlays="activeOverlays" :network="network" :by-activity="byActivity" :issue="drawing.issue.value"
      :points="track.points.length" :metrics="drawing.metrics.value" :minutes="minutes"
      :profile="drawing.profile.value" :busy="drawing.busy.value" :can-undo="drawing.canUndo.value"
      :can-redo="drawing.canRedo.value" @toggle-overlay="mapStore.toggleOverlay($event)" @undo="drawing.undo()"
      @redo="drawing.redo()" @cancel="emit('cancel')" @done="emit('done', track)"
    />
  </Teleport>
</template>

<style>
/* While drawing, a tap on a tour marker sets a point like anywhere else on the map. */
.track-drawing .maplibregl-marker {
  pointer-events: none;
}
</style>
