<script setup lang="ts">
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalCursorSource } from '@/features/presence/presentation/composables/use-local-cursor-source'
import { usePresenceStore } from '@/features/presence/presentation/stores/presence-store'

interface PresencePointFeature {
  type: 'Feature'
  geometry: { type: 'Point', coordinates: [number, number] }
  properties: { name: string, color: string }
}

interface PresenceFeatureCollection {
  type: 'FeatureCollection'
  features: PresencePointFeature[]
}

const props = defineProps<{
  map: MapLibreMap
}>()

const { t } = useI18n({ useScope: 'global' })
const presenceStore = usePresenceStore()
const { friendCursors } = storeToRefs(presenceStore)

presenceStore.attachMapSession()

const SOURCE_ID = 'presence-cursors'
const CIRCLE_LAYER_ID = 'presence-cursors-dot'
const SYMBOL_LAYER_ID = 'presence-cursors-label'

const a11ySummary = computed(() => {
  const parts = [...friendCursors.value.values()].map(c =>
    t('presence.cursor.ariaLabel', { name: c.displayName }),
  )
  return parts.join('. ')
})

const ANIM_MS = 80

const displayPositions = shallowRef(new Map<string, { lon: number, lat: number }>())
const animState = shallowRef(new Map<string, { from: { lon: number, lat: number }, to: { lon: number, lat: number }, start: number }>())
let rafId = 0

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u
}

function cancelRaf() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function pushGeojson() {
  const m = props.map
  const src = m.getSource(SOURCE_ID) as GeoJSONSource | undefined
  if (!src || src.type !== 'geojson')
    return

  const features: PresencePointFeature[] = []
  for (const c of friendCursors.value.values()) {
    const pos = displayPositions.value.get(c.userId)
    if (!pos)
      continue
    const label = c.displayName.length > 12 ? `${c.displayName.slice(0, 12)}…` : c.displayName
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] },
      properties: {
        name: label,
        color: c.color,
      },
    })
  }
  const fc: PresenceFeatureCollection = { type: 'FeatureCollection', features }
  src.setData(fc)
}

function tick() {
  const now = performance.now()
  const nextDisplay = new Map(displayPositions.value)
  const nextAnim = new Map(animState.value)
  let needsNextFrame = false

  for (const [uid, anim] of nextAnim) {
    const u = Math.min(1, (now - anim.start) / ANIM_MS)
    nextDisplay.set(uid, {
      lon: lerp(anim.from.lon, anim.to.lon, u),
      lat: lerp(anim.from.lat, anim.to.lat, u),
    })
    if (u < 1)
      needsNextFrame = true
    else
      nextAnim.delete(uid)
  }

  displayPositions.value = nextDisplay
  animState.value = nextAnim
  pushGeojson()

  if (needsNextFrame)
    rafId = requestAnimationFrame(tick)
  else
    rafId = 0
}

function startRaf() {
  if (!rafId)
    rafId = requestAnimationFrame(tick)
}

function removeLayers() {
  const m = props.map
  if (m.getLayer(SYMBOL_LAYER_ID))
    m.removeLayer(SYMBOL_LAYER_ID)
  if (m.getLayer(CIRCLE_LAYER_ID))
    m.removeLayer(CIRCLE_LAYER_ID)
  if (m.getSource(SOURCE_ID))
    m.removeSource(SOURCE_ID)
}

function addLayers() {
  const m = props.map
  if (!m.isStyleLoaded())
    return
  if (m.getSource(SOURCE_ID))
    return

  const empty: PresenceFeatureCollection = { type: 'FeatureCollection', features: [] }
  m.addSource(SOURCE_ID, { type: 'geojson', data: empty })
  m.addLayer({
    id: CIRCLE_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': 6,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  })
  m.addLayer({
    id: SYMBOL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-offset': [0, -1.35],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  })
}

function onStyleReady() {
  removeLayers()
  addLayers()
  pushGeojson()
}

watch(
  friendCursors,
  () => {
    const next = friendCursors.value
    const prevDisplay = displayPositions.value
    const nextAnim = new Map(animState.value)
    const nextDisplay = new Map(prevDisplay)

    for (const uid of prevDisplay.keys()) {
      if (!next.has(uid)) {
        nextDisplay.delete(uid)
        nextAnim.delete(uid)
      }
    }

    for (const [uid, c] of next) {
      const prev = nextDisplay.get(uid)
      const target = { lon: c.lon, lat: c.lat }
      if (!prev) {
        nextDisplay.set(uid, target)
        continue
      }
      if (prev.lon !== target.lon || prev.lat !== target.lat)
        nextAnim.set(uid, { from: prev, to: target, start: performance.now() })
    }

    displayPositions.value = nextDisplay
    animState.value = nextAnim
    startRaf()
  },
  { deep: true },
)

onMounted(() => {
  const m = props.map
  if (m.isStyleLoaded())
    onStyleReady()
  m.on('load', onStyleReady)
  m.on('style.load', onStyleReady)
})

onBeforeUnmount(() => {
  cancelRaf()
  const m = props.map
  m.off('load', onStyleReady)
  m.off('style.load', onStyleReady)
  removeLayers()
  presenceStore.detachMapSession()
})

useLocalCursorSource(() => props.map)
</script>

<template>
  <div
    class="sr-only"
    role="status"
    aria-live="polite"
  >
    {{ a11ySummary }}
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
