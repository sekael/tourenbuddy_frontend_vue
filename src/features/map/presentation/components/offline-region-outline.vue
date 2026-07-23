<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref } from 'vue'

type Bbox = [number, number, number, number]

const props = defineProps<{ map: MapLibreMap | null, bbox: Bbox }>()

// Read-only twin of OfflineRegionDraw's rectangle: shows the confirmed download
// extent while the download sheet is open. Geo-anchored — the pixel rect is
// re-derived on every map move so it stays pinned to the ground.
const rect = ref<{ left: number, top: number, width: number, height: number } | null>(null)

// Project the two diagonal geo corners to container pixels and derive the CSS
// rect. Corners are picked to match screen axes: the NW corner (minLng, maxLat)
// is top-left because latitude and screen-y run OPPOSITE ways — north (maxLat)
// is up, i.e. the smaller y. So topLeft.y < bottomRight.y and height is
// bottom − top. Longitude and screen-x agree (east = larger x), so width is
// just east − west. Runs on every map 'move' to stay pinned to the ground.
function sync() {
  if (!props.map) {
    return
  }
  const minLng = props.bbox[0]
  const minLat = props.bbox[1]
  const maxLng = props.bbox[2]
  const maxLat = props.bbox[3]

  const topLeft = props.map.project([minLng, maxLat])
  const bottomRight = props.map.project([maxLng, minLat])

  rect.value = { left: topLeft.x, top: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y }
}

onMounted(() => {
  const m = props.map
  if (!m)
    return
  sync()
  m.on('move', sync)
})
onBeforeUnmount(() => props.map?.off('move', sync))
</script>

<template>
  <div
    v-if="rect"
    class="outline"
    :style="{
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    }"
  />
</template>

<style scoped>
.outline {
  position: absolute;
  border: 2px solid var(--color-accent, #2563eb);
  background-color: color-mix(in srgb, var(--color-accent, #2563eb) 18%, transparent);
  pointer-events: none;
  /* Below the download sheet (.sheet-container z-index: 50) and tour pill (.pill z-index: 15)
    the outline is map furniture, it must sit under the dialog, above the tiles. */
  z-index: 10;
}
</style>
