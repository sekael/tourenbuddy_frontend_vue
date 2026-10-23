<script setup lang="ts">
import type { FlyToOptions, Map as MapLibreMap } from 'maplibre-gl'
import type { LocationResult, PickRole } from '@/features/map/data/services/swisstopo-search-service'
import { useFocusWithin, usePreferredReducedMotion, watchDebounced } from '@vueuse/core'
import { LngLat } from 'maplibre-gl'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import Crosshair from '@/core/components/crosshair.vue'
import SearchInput from '@/core/components/search-input.vue'
import { useIsTouch } from '@/core/composables/use-is-touch'
import { useVisualViewportTop } from '@/core/composables/use-visual-viewport-top'
import { isOnline } from '@/core/offline/use-online-status'
import { rankResults, searchLocations } from '@/features/map/data/services/swisstopo-search-service'
import LocationSearchResults from './location-search-results.vue'

const props = defineProps<{
  map: MapLibreMap | null
  /** Pixels to offset the dock (search field + Cancel/Continue) from the bottom of the viewport. */
  actionsBottom?: number
  /** What is picked: a start or end point also finds stops and ranks access places first. */
  role?: PickRole
}>()

const emit = defineEmits<{
  /** `name` only when the crosshair still sits on the last chosen search result. */
  confirm: [location: { lng: number, lat: number, name?: string }]
  cancel: []
  /** True while the user searches on a touch screen: the page hides its collapsed sheet. */
  searching: [active: boolean]
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
 * Results, search field and actions share one bottom dock: in thumb reach on phones, and
 * clear of the collapsed overlay header at the top. While the user searches on a touch
 * screen (field focused or list open) the field moves to the visible top with the results
 * below it and the actions hidden: the keyboard covers the bottom, and the top is the one
 * edge every mobile browser reports right. Staying in that layout while the list is open
 * keeps a result in place for the tap that blurs the field.
 */
const isTouch = useIsTouch()
const { focused } = useFocusWithin(computed(() => searchInput.value?.$el as HTMLElement | undefined))
const searching = computed(() => isTouch.value && (focused.value || listOpen.value))
watch(searching, active => emit('searching', active), { immediate: true })
const viewportTop = useVisualViewportTop()
const dockStyle = computed(() => ({
  '--dock-bottom': props.actionsBottom != null ? `${props.actionsBottom}px` : undefined,
  '--viewport-top': `${viewportTop.value}px`,
}))

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
    const found = await searchLocations(trimmed, locale.value, own.signal, props.role)
    if (controller !== own || !props.map)
      return
    results.value = rankResults(found, getCrosshairCoordinates(props.map), props.map.getZoom(), props.role)
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

function clearQuery() {
  query.value = ''
  searchInput.value?.focus()
}

/**
 * The flight to the last chosen result. MapLibre aims a flight at the canvas centre it
 * measured at take-off, and the tap that chose the result also closes the on-screen keyboard,
 * which resizes the map mid-flight on phones: the result would land off the crosshair. So a
 * resize during that flight re-issues it (from where the camera is), until the user takes the map.
 */
let flight: FlyToOptions | null = null

function reaim() {
  if (flight && props.map?.isEasing())
    props.map.flyTo(flight)
}

function releaseMap() {
  flight = null
  closeList()
}

function choose(result: LocationResult | undefined) {
  if (!result || !props.map)
    return
  chosen.value = result
  query.value = result.name
  closeList()
  // Zero padding: a framed tour leaves padding set, which would park the result off-crosshair.
  const camera = { center: [result.lng, result.lat] as [number, number], zoom: result.zoom, padding: { top: 0, right: 0, bottom: 0, left: 0 } }
  if (reducedMotion.value === 'reduce') {
    props.map.jumpTo(camera)
    return
  }
  flight = camera
  props.map.flyTo(camera)
}

// Touching, dragging or zooming the map hands focus (and the camera) back to the map.
const MAP_INPUT_EVENTS = ['mousedown', 'touchstart', 'wheel'] as const
watch(() => props.map, (map, previous) => {
  for (const event of MAP_INPUT_EVENTS) {
    previous?.off(event, releaseMap)
    map?.on(event, releaseMap)
  }
  previous?.off('resize', reaim)
  map?.on('resize', reaim)
}, { immediate: true })
onBeforeUnmount(() => {
  MAP_INPUT_EVENTS.forEach(event => props.map?.off(event, releaseMap))
  props.map?.off('resize', reaim)
})

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

    <div class="dock" :class="{ 'dock--searching': searching }" :style="dockStyle">
      <Transition name="results">
        <LocationSearchResults v-if="isOnline && listOpen" :results="results" :failed="searchFailed" @choose="choose" />
      </Transition>

      <SearchInput
        v-if="isOnline" ref="searchInput" v-model="query" class="search-field"
        :placeholder="role === 'start' || role === 'end' ? t('tours.picker.search.placeholderAccess') : t('tours.picker.search.placeholder')" :label="t('tours.picker.search.label')"
        @enter="choose(results[0])" @escape="closeList"
      >
        <!-- mousedown.prevent: the tap must not blur the field, or the dock would flip under the finger. -->
        <BaseIconButton v-if="query" name="close" size="sm" :label="t('tours.picker.search.clear')" @mousedown.prevent @click="clearQuery" />
      </SearchInput>

      <div v-show="!searching" class="actions">
        <BaseButton variant="secondary" class="on-map" @click="emit('cancel')">
          {{ t('tours.picker.cancelBtn') }}
        </BaseButton>
        <BaseButton variant="primary" data-testid="picker-confirm" @click="handleConfirm">
          {{ t('tours.picker.confirmBtn') }}
        </BaseButton>
      </div>
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

/* Fixed, so it stays above Android system nav and Brave bottom chrome and clears the notch
   in a standalone PWA (parent .location-picker is absolute inside page-root 100lvh). Spans
   from the visible top down to its offset and stacks at the bottom, so a long result list
   scrolls instead of running off-screen. */
.dock {
  position: fixed;
  top: calc(var(--viewport-top) + var(--safe-top) + var(--spacing-md));
  bottom: var(--dock-bottom, calc(var(--spacing-lg) + var(--safe-bottom)));
  left: 0;
  right: 0;
  width: min(440px, calc(100% - 2 * var(--spacing-md)));
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  pointer-events: none;
  /* Above the crosshair (z 15): results that reach the map centre must hide the reticle. */
  z-index: 16;
  transition: bottom var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.dock > * {
  pointer-events: auto;
}

/* Searching on a touch screen: field at the visible top, results open downward, so the
   field and the best results stay clear of the keyboard wherever the browser puts it. */
.dock--searching {
  bottom: auto;
  flex-direction: column-reverse;
}

/* Floating pill over the map: frosted and lifted, brand ring while typing. */
.search-field {
  flex-shrink: 0;
  min-height: 52px;
  padding: var(--spacing-xxs) var(--spacing-xs) var(--spacing-xxs) var(--spacing-md);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-background) 86%, transparent);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  box-shadow: var(--shadow-lg);
  transition:
    border-color var(--motion-duration-short) var(--motion-ease-standard),
    background-color var(--motion-duration-short) var(--motion-ease-standard),
    box-shadow var(--motion-duration-short) var(--motion-ease-standard);
}

.search-field:focus-within {
  border-color: var(--color-primary);
  background-color: var(--color-background);
  box-shadow: var(--shadow-lg), var(--input-focus-ring);
}

.search-field :deep(.search-icon) {
  color: var(--color-primary);
}

.search-field :deep(.search-input) {
  align-self: stretch;
}

/* Our own clear button instead of the browser's (absent in Firefox, dated elsewhere). */
.search-field :deep(.search-input::-webkit-search-cancel-button) {
  display: none;
}

.results-enter-active,
.results-leave-active {
  transform-origin: bottom center;
  transition:
    opacity var(--motion-duration-short) var(--motion-ease-standard),
    transform var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.results-enter-from,
.results-leave-to {
  opacity: 0;
  transform: translateY(var(--motion-offset)) scale(0.98);
}

.dock--searching .results-enter-active {
  transform-origin: top center;
}

.dock--searching .results-enter-from {
  transform: translateY(calc(-1 * var(--motion-offset))) scale(0.98);
}

/* The dock flips back to the bottom as the list closes; fading out there would flash. */
@media (hover: none) {
  .results-leave-active {
    transition: none;
  }
}

.actions {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  gap: var(--spacing-md);
}

/* Tonal secondary needs a lift to stand off bright terrain */
.on-map {
  box-shadow: var(--shadow-md);
}
</style>
