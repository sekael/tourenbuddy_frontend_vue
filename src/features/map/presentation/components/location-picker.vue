<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { LocationResult } from '@/features/map/data/services/swisstopo-search-service'
import { usePreferredReducedMotion, watchDebounced } from '@vueuse/core'
import { LngLat } from 'maplibre-gl'
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import Crosshair from '@/core/components/crosshair.vue'
import SearchInput from '@/core/components/search-input.vue'
import { isOnline } from '@/core/offline/use-online-status'
import { rankResults, searchLocations } from '@/features/map/data/services/swisstopo-search-service'
import LocationSearchResults from './location-search-results.vue'

const props = defineProps<{
  map: MapLibreMap | null
  /** Pixels to offset the Cancel/Continue buttons from the bottom of the viewport. */
  actionsBottom?: number
}>()

const emit = defineEmits<{
  /** `name` only when the crosshair still sits on the last chosen search result. */
  confirm: [location: { lng: number, lat: number, name?: string }]
  cancel: []
}>()

/** A confirm this close to the chosen result keeps the result's name (touch drift). */
const NAME_RADIUS_M = 50

const { t, locale } = useI18n({ useScope: 'global' })
const reducedMotion = usePreferredReducedMotion()
const searchInput = useTemplateRef<InstanceType<typeof SearchInput>>('searchInput')

const query = ref('')
const results = ref<LocationResult[]>([])
const searchFailed = ref(false)
const listOpen = ref(false)
const chosen = ref<LocationResult | null>(null)

/**
 * Returns the geographic coordinates at the visual center of the map canvas —
 * i.e., exactly where the crosshair SVG renders.
 *
 * We MUST NOT use `map.getCenter()` here: MapLibre's `getCenter()` returns the
 * center of the *padded* viewport, and any camera call that passes `padding` to
 * `flyTo` / `easeTo` leaves it set on the map. That would offset the saved
 * location from where the user aimed the crosshair.
 *
 * `map.unproject()` converts a pixel position to geographic coordinates and is
 * unaffected by padding state.
 */
function getCrosshairCoordinates(map: NonNullable<typeof props.map>) {
  const canvas = map.getCanvas()
  return map.unproject([canvas.clientWidth / 2, canvas.clientHeight / 2])
}

/**
 * Every run replaces `controller` first — even one that returns early — so an older
 * request is aborted, and any answer it still delivers fails the `controller !== own` check.
 */
let controller: AbortController | null = null

watchDebounced(query, async (q) => {
  controller?.abort()
  const own = new AbortController()
  controller = own

  const trimmed = q.trim()
  if (trimmed.length < 2) {
    listOpen.value = false
    return
  }
  // The chosen result's name was written into the field — no need to search it again.
  if (chosen.value?.name === trimmed)
    return

  try {
    const found = await searchLocations(trimmed, locale.value, own.signal)
    if (controller !== own || !props.map)
      return
    results.value = rankResults(found, getCrosshairCoordinates(props.map), props.map.getZoom())
    searchFailed.value = false
  }
  catch (err) {
    // Superseded or aborted on purpose: stay silent, the newer run owns the list.
    if (controller !== own || (err instanceof DOMException && err.name === 'AbortError'))
      return
    results.value = []
    searchFailed.value = true
  }
  // Not `finally`: that would also run on the silent returns above and open the list.
  listOpen.value = true
}, { debounce: 300 })
onBeforeUnmount(() => controller?.abort())

// Clearing the field also forgets the chosen result (no stale name on confirm).
watch(query, (q) => {
  if (!q.trim())
    chosen.value = null
})

function closeList() {
  listOpen.value = false
  searchInput.value?.blur()
}

function choose(result: LocationResult | undefined) {
  if (!result || !props.map)
    return
  chosen.value = result
  query.value = result.name
  closeList()
  // Zero padding: a framed tour leaves padding set, which would park the result off-crosshair.
  const camera = { center: [result.lng, result.lat] as [number, number], zoom: result.zoom, padding: { top: 0, right: 0, bottom: 0, left: 0 } }
  if (reducedMotion.value === 'reduce')
    props.map.jumpTo(camera)
  else
    props.map.flyTo(camera)
}

// Touching, dragging or zooming the map hands focus back to the map.
const MAP_INPUT_EVENTS = ['mousedown', 'touchstart', 'wheel'] as const
watch(() => props.map, (map, previous) => {
  for (const event of MAP_INPUT_EVENTS) {
    previous?.off(event, closeList)
    map?.on(event, closeList)
  }
}, { immediate: true })
onBeforeUnmount(() => MAP_INPUT_EVENTS.forEach(event => props.map?.off(event, closeList)))

function handleConfirm() {
  if (!props.map)
    return
  const coords = getCrosshairCoordinates(props.map)
  const onResult = chosen.value
    && new LngLat(chosen.value.lng, chosen.value.lat).distanceTo(new LngLat(coords.lng, coords.lat)) <= NAME_RADIUS_M
  emit('confirm', onResult ? { lng: coords.lng, lat: coords.lat, name: chosen.value!.name } : { lng: coords.lng, lat: coords.lat })
}
</script>

<template>
  <div class="location-picker">
    <Crosshair />

    <div v-if="isOnline" class="search">
      <SearchInput
        ref="searchInput" v-model="query" class="search-field"
        :placeholder="t('tours.picker.search.placeholder')" :label="t('tours.picker.search.label')"
        @enter="choose(results[0])" @escape="closeList"
      />
      <LocationSearchResults v-if="listOpen" :results="results" :failed="searchFailed" @choose="choose" />
    </div>

    <div
      class="actions"
      :style="props.actionsBottom != null ? { bottom: `${props.actionsBottom}px` } : undefined"
    >
      <BaseButton variant="secondary" class="on-map" @click="emit('cancel')">
        {{ t('tours.picker.cancelBtn') }}
      </BaseButton>
      <BaseButton variant="primary" data-testid="picker-confirm" @click="handleConfirm">
        {{ t('tours.picker.confirmBtn') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.location-picker {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 200;
}

/* Fixed like the actions, so it clears the status bar / notch in a standalone PWA. */
.search {
  position: fixed;
  top: calc(var(--spacing-md) + var(--safe-top));
  left: 50%;
  transform: translateX(-50%);
  width: min(420px, calc(100% - 2 * var(--spacing-md)));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  pointer-events: all;
}

.search-field {
  box-shadow: var(--shadow-md);
}

.actions {
  /* fixed so actions stay above Android system nav and Brave bottom chrome
     (parent .location-picker is absolute inside page-root 100lvh). */
  position: fixed;
  bottom: calc(var(--spacing-lg) + var(--safe-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--spacing-md);
  pointer-events: all;
}

/* Tonal secondary needs a lift to stand off bright terrain */
.on-map {
  box-shadow: var(--shadow-md);
}
</style>
