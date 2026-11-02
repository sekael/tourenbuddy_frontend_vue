<script setup lang="ts">
import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent, PaddingOptions, Point } from 'maplibre-gl'
import type { LocationResult } from '@/features/map/data/services/swisstopo-search-service'
import type { PlannedPoint, RoutePoints, RouteStep } from '@/features/map/domain/route-plan'
import { useElementSize, useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { LngLatBounds } from 'maplibre-gl'
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import SearchInput from '@/core/components/search-input.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useSheetInset } from '@/core/composables/use-sheet-inset'
import { isOnline } from '@/core/offline/use-online-status'
import { nextStep, ROUTE_STEPS, routeClimb } from '@/features/map/domain/route-plan'
import { FLIGHT_SPEED, frameBounds, isBoundsVisible, TOUR_ZOOM } from '@/features/map/presentation/composables/frame-tour'
import { useLocationSearch } from '@/features/map/presentation/composables/use-location-search'
import { getElevation } from '@/features/tours/data/services/swisstopo-elevation-service'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'
import LocationSearchResults from './location-search-results.vue'

/**
 * The route step of a tour's creation (map-first-tour-creation D1): start → goal → end set in order
 * by a tap on the map or a search result, each named and measured at once, any of them dragged to
 * move it. The map draws the points and legs from `change`; this panel shows the steps, the climb
 * and descent, and what to do next.
 */
const props = defineProps<{
  map: MapLibreMap | null
  /** The points to start from (read once): none for a new tour, a seeded start, or the form's. */
  initial: RoutePoints
  /** The step to start on. */
  step: RouteStep
  title: string
  /** "Continue" into the form, or "Done" back to it. */
  doneLabel: string
  /** A tap the page takes instead (a marked ski route): no point is set there. */
  routeHit?: (point: Point) => boolean
  /** Another way to set the route, e.g. tapping a marked ski route. */
  hint?: string
  /** The map area the page covers beside the planner (the form's drawer on desktop). */
  covered?: Partial<PaddingOptions>
}>()

const emit = defineEmits<{ change: [points: RoutePoints], done: [points: RoutePoints], cancel: [] }>()

const { t, locale } = useI18n({ useScope: 'global' })
const { formatElevation } = useFormatter()
const reducedMotion = usePreferredReducedMotion()

const points = reactive<RoutePoints>({ ...props.initial })
const active = ref<RouteStep>(props.step)
watch(points, p => emit('change', { ...p }), { immediate: true })
// A point handed over still unnamed (the next day starting at a goal) is looked up like a new one.
onMounted(() => ROUTE_STEPS.forEach((step) => {
  const p = points[step]
  if (p?.loading)
    place(step, p.location)
}))
// The points it opens with (the next day's start, the form's route) come into view beside the panel.
onMounted(() => frameRoute(null, Math.max(props.map?.getZoom() ?? 0, TOUR_ZOOM)))

// ── Lookups: a set point is named (unless a search named it) and measured at once ────────────
const lookups: Partial<Record<RouteStep, AbortController>> = {}

function place(step: RouteStep, location: { lng: number, lat: number }, name?: string) {
  lookups[step]?.abort()
  const own = new AbortController()
  lookups[step] = own
  const point: PlannedPoint = { location, name: name ?? null, elevation: null, loading: true }
  points[step] = point
  void Promise.all([
    name ?? suggestTourName(location, own.signal).catch(() => null),
    getElevation(location, own.signal).catch(() => null),
  ]).then(([found, height]) => {
    if (lookups[step] !== own)
      return
    points[step] = { ...point, name: found ?? null, elevation: height, loading: false }
  })
}

/** A point just set moves the plan on to the next step still open. */
function setAndAdvance(step: RouteStep, location: { lng: number, lat: number }, name?: string) {
  place(step, location, name)
  active.value = nextStep(points, step)
}

function clear(step: RouteStep) {
  lookups[step]?.abort()
  delete lookups[step]
  points[step] = null
}
onBeforeUnmount(() => ROUTE_STEPS.forEach(step => lookups[step]?.abort()))

function skip() {
  active.value = nextStep(points, active.value)
}

function roundTrip() {
  const start = points.start
  if (!start)
    return
  lookups.end?.abort()
  points.end = { ...start, location: { ...start.location } }
}

// ── Search ──────────────────────────────────────────────────────────────────
const searchInput = useTemplateRef<InstanceType<typeof SearchInput>>('searchInput')
const panel = useTemplateRef<HTMLElement>('panel')
const { height } = useElementSize(panel, undefined, { box: 'border-box' })
const isDesktop = useIsDesktop()
const NO_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }
const search = useLocationSearch({
  locale: () => locale.value,
  role: () => active.value,
  origin: () => props.map && { center: props.map.getCenter(), zoom: props.map.getZoom() },
})
const { query, results, failed, listOpen } = search

function choose(result: LocationResult | undefined) {
  if (!result)
    return
  search.take(result)
  query.value = ''
  searchInput.value?.blur()
  setAndAdvance(active.value, { lng: result.lng, lat: result.lat }, result.name)
  frameRoute({ lng: result.lng, lat: result.lat }, result.zoom)
}

/**
 * After a search the route shows whole: every set point framed beside the panel and the search,
 * not the result alone — a lone point flies in at the result's own zoom.
 */
function frameRoute(at: { lng: number, lat: number } | null, zoom: number) {
  const map = props.map
  const set = ROUTE_STEPS.flatMap(step => (points[step] ? [points[step]!.location] : []))
  if (!map || set.length === 0)
    return
  // Measured now: the search pill alone (not its open list), the panel as it stands.
  const desktop = isDesktop.value
  const panelBox = panel.value?.getBoundingClientRect()
  const covered = {
    top: (searchInput.value?.$el as HTMLElement | undefined)?.getBoundingClientRect().bottom ?? 0,
    bottom: desktop ? 0 : (panelBox?.height ?? 0),
    left: desktop ? (panelBox?.right ?? 0) : 0,
    right: props.covered?.right ?? 0,
  }
  const bounds = set.reduce((b, p) => b.extend([p.lng, p.lat]), new LngLatBounds())
  if (set.length > 1) {
    if (!isBoundsVisible(map, bounds, covered))
      frameBounds(map, bounds, covered, { maxZoom: Math.max(zoom, TOUR_ZOOM) })
    return
  }
  const lone = at ?? set[0]!
  if (!at && isBoundsVisible(map, bounds, covered))
    return
  // Centred in the area beside the panel by an offset: padding would stay set on the map and add to
  // every later framing's own (`frameBounds`), so it is cleared here.
  const offset: [number, number] = [(covered.left - covered.right) / 2, (covered.top - covered.bottom) / 2]
  const camera = { center: [lone.lng, lone.lat] as [number, number], zoom, offset, padding: NO_MARGIN, speed: FLIGHT_SPEED }
  if (reducedMotion.value === 'reduce')
    map.jumpTo(camera)
  else
    map.flyTo(camera)
}

// ── Gestures: a tap sets the active point, a press on a point drags it ──────────────────
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

/** The set point under `at`, within fingertip reach. */
function pointAt(at: Point): RouteStep | null {
  const reach = coarse() ? 24 : 12
  let best: RouteStep | null = null
  let bestDistance = reach
  for (const step of ROUTE_STEPS) {
    const p = points[step]
    const d = p ? props.map!.project([p.location.lng, p.location.lat]).dist(at) : Infinity
    if (d <= bestDistance) {
      best = step
      bestDistance = d
    }
  }
  return best
}

let drag: { step: RouteStep, from: Point, to: { lng: number, lat: number } | null } | null = null
/** A drag ends in a click event too; that one must not set a point. */
let dragged = false

function onClick(e: MapMouseEvent) {
  if (dragged) {
    dragged = false
    return
  }
  const hit = pointAt(e.point)
  if (hit) {
    active.value = hit
    return
  }
  if (props.routeHit?.(e.point))
    return
  setAndAdvance(active.value, { lng: e.lngLat.lng, lat: e.lngLat.lat })
}

function onPress(e: MapMouseEvent | MapTouchEvent) {
  if ('touches' in e.originalEvent && e.originalEvent.touches.length > 1)
    return
  const hit = pointAt(e.point)
  if (!hit)
    return
  // Holds the map still: this gesture moves the point, not the map.
  e.preventDefault()
  drag = { step: hit, from: e.point, to: null }
}

function onMove(e: MapMouseEvent | MapTouchEvent) {
  if (!drag) {
    if (!coarse())
      props.map!.getCanvas().style.cursor = pointAt(e.point) ? 'grab' : 'crosshair'
    return
  }
  // Under 4 px it is a tap on the point, not a drag.
  if (!drag.to && e.point.dist(drag.from) < 4)
    return
  drag.to = { lng: e.lngLat.lng, lat: e.lngLat.lat }
  const p = points[drag.step]
  if (p)
    points[drag.step] = { ...p, location: drag.to }
}

function onRelease() {
  if (drag?.to) {
    dragged = true
    active.value = drag.step
    // Elsewhere now: named and measured again, as a new tap would be.
    place(drag.step, drag.to)
    // A touch drag fires no click to reset it.
    setTimeout(() => (dragged = false), 0)
  }
  drag = null
}

const MAP_EVENTS = [
  ['click', onClick],
  ['mousedown', onPress],
  ['touchstart', onPress],
  ['mousemove', onMove],
  ['touchmove', onMove],
  ['mouseup', onRelease],
  ['touchend', onRelease],
  ['touchcancel', onRelease],
] as const

onMounted(() => {
  const map = props.map
  if (!map)
    return
  for (const [event, handler] of MAP_EVENTS)
    map.on(event, handler as never)
  // Double-tap zoom would read as two points.
  map.doubleClickZoom.disable()
  map.getContainer().classList.add('route-planning')
  if (!coarse())
    map.getCanvas().style.cursor = 'crosshair'
})

onBeforeUnmount(() => {
  const map = props.map
  if (!map)
    return
  for (const [event, handler] of MAP_EVENTS)
    map.off(event, handler as never)
  map.doubleClickZoom.enable()
  map.getContainer().classList.remove('route-planning')
  map.getCanvas().style.cursor = ''
})

// Escape leaves the route step only — before the drawer beside it (desktop) reads it as closing the form.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented)
    return
  if (listOpen.value) {
    listOpen.value = false
  }
  else {
    emit('cancel')
  }
  e.preventDefault()
}, { capture: true })

// ── Panel ───────────────────────────────────────────────────────────────────
const STEP_ICONS: Record<RouteStep, string> = { start: 'trip_origin', goal: 'flag', end: 'sports_score' }

/**
 * The climb and descent as last known: while a height loads they hold (no blank in between, no
 * guess) and change once, to the final numbers.
 */
const climb = ref(routeClimb(points))
watchEffect(() => {
  if (!ROUTE_STEPS.some(step => points[step]?.loading))
    climb.value = routeClimb(points)
})
const instruction = computed(() => points[active.value]
  ? t('map.plan.hint.move')
  : t(`map.plan.hint.${active.value}`))

/** The panel's one secondary action for the active step. */
const secondary = computed<'skip' | 'roundTrip' | 'remove' | null>(() => {
  const step = active.value
  if (step === 'goal')
    return null
  if (points[step])
    return 'remove'
  if (step === 'end')
    return points.start ? 'roundTrip' : null
  return 'skip'
})

function runSecondary() {
  if (secondary.value === 'skip')
    skip()
  else if (secondary.value === 'roundTrip')
    roundTrip()
  else if (secondary.value === 'remove')
    clear(active.value)
}

// On a phone the panel is a bottom sheet: bottom toasts (`--sheet-inset`) rise above its buttons,
// and the camera frames above it. Docked left on desktop, it leaves the centred toasts clear.
const publishInset = useSheetInset()
watchEffect(() => publishInset(isDesktop.value ? 0 : height.value))
</script>

<template>
  <Teleport to="body">
    <div class="planner-search" :class="{ 'planner-search--open': listOpen }">
      <SearchInput
        v-if="isOnline" ref="searchInput" v-model="query" class="search-field"
        :placeholder="active === 'goal' ? t('tours.picker.search.placeholder') : t('tours.picker.search.placeholderAccess')"
        :label="t('tours.picker.search.label')" data-testid="planner-search"
        @enter="choose(results[0])"
      >
        <BaseIconButton v-if="query" name="close" size="sm" :label="t('tours.picker.search.clear')" @mousedown.prevent @click="query = ''" />
      </SearchInput>
      <Transition name="results">
        <LocationSearchResults v-if="isOnline && listOpen" :results="results" :failed="failed" @choose="choose" />
      </Transition>
    </div>

    <section ref="panel" class="planner" :aria-label="title" data-testid="route-planner">
      <header class="head">
        <h2 class="title">
          {{ title }}
        </h2>
        <BaseIconButton name="close" variant="tonal" :label="t('tours.picker.cancelBtn')" data-testid="planner-cancel" @click="emit('cancel')" />
      </header>

      <div class="steps" role="group" :aria-label="t('map.plan.stepsLabel')">
        <button
          v-for="kind in ROUTE_STEPS" :key="kind" type="button" class="step"
          :class="{ 'step--active': active === kind, 'step--set': !!points[kind] }" :aria-pressed="active === kind"
          :data-testid="`planner-step-${kind}`" @click="active = kind"
        >
          <span class="step-label">
            <BaseIcon :name="STEP_ICONS[kind]" size="sm" class="step-icon" />
            {{ t(`map.plan.step.${kind}`) }}
          </span>
          <span v-if="points[kind]?.loading" class="step-skeleton" aria-hidden="true" />
          <template v-else-if="points[kind]">
            <span class="step-name">{{ points[kind]!.name || t('map.plan.unnamed') }}</span>
            <span class="step-height">{{ points[kind]!.elevation == null ? '–' : formatElevation(points[kind]!.elevation!) }}</span>
          </template>
          <span v-else class="step-empty">{{ kind === 'goal' ? t('map.plan.required') : t('map.plan.optional') }}</span>
        </button>
      </div>

      <p class="status" role="status">
        <span class="climb" :class="{ 'climb--empty': !climb }" data-testid="planner-climb">
          <span aria-hidden="true">↗</span><span class="visually-hidden">{{ t('tours.route.ascent') }}</span>
          {{ climb ? formatElevation(climb.ascent) : '–' }}
          <span aria-hidden="true">↘</span><span class="visually-hidden">{{ t('tours.route.descent') }}</span>
          {{ climb ? formatElevation(climb.descent) : '–' }}
        </span>
        <span class="instruction">{{ instruction }}</span>
      </p>
      <p v-if="hint" class="route-hint">
        {{ hint }}
      </p>

      <div class="actions">
        <BaseButton v-if="secondary" variant="secondary" :data-testid="`planner-${secondary}`" @click="runSecondary">
          <BaseIcon v-if="secondary === 'roundTrip'" name="replay" />
          {{ t(`map.plan.${secondary}`) }}
        </BaseButton>
        <span class="spacer" />
        <BaseButton variant="primary" :disabled="!points.goal" data-testid="planner-done" @click="emit('done', { ...points })">
          {{ doneLabel }}
        </BaseButton>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.planner {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* Above the collapsed form bar (full-screen page z 60), which it covers on phones. */
  z-index: 61;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md) calc(var(--spacing-md) + var(--safe-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-background);
  box-shadow: var(--shadow-lg);
}

.planner-search {
  position: fixed;
  top: calc(var(--safe-top) + var(--spacing-md));
  left: var(--spacing-md);
  right: var(--spacing-md);
  z-index: 62;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  /* Results scroll above the panel instead of running under it. */
  max-height: calc(100dvh - var(--safe-top) - var(--sheet-inset, 0px) - 2 * var(--spacing-md));
  pointer-events: none;
}

.planner-search > * {
  pointer-events: auto;
}

/* Docked left on desktop: the middle of the map, and the form drawer on the right, stay clear. */
@media (min-width: 600px) {
  .planner {
    left: var(--spacing-lg);
    right: auto;
    bottom: var(--spacing-lg);
    width: 420px;
    border-radius: var(--radius-lg);
    padding-bottom: var(--spacing-md);
  }

  .planner-search {
    top: calc(var(--safe-top) + var(--spacing-lg));
    left: var(--spacing-lg);
    right: auto;
    width: 420px;
  }
}

.head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.steps {
  display: grid;
  gap: var(--spacing-xxs);
}

/* Phones: one row per step, the name with the width of the panel — "Meiringen (Luftseilbahn)"
   reads whole, wrapping at its spaces, never cut. */
.step {
  display: grid;
  grid-template-columns: 4.75rem minmax(0, 1fr) auto;
  align-items: center;
  column-gap: var(--spacing-sm);
  min-width: 0;
  min-height: 44px;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-on-surface);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

/* Desktop: three tiles side by side in the docked panel. */
@media (min-width: 600px) {
  .steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--spacing-xs);
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    /* A two-line name and the height under the label, whatever they hold: the panel never jumps. */
    min-height: 90px;
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .step-name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
}

.step--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
}

.step-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
}

.step--active .step-label {
  color: var(--color-primary);
}

.step-name,
.step-empty {
  max-width: 100%;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

/* Breaks at spaces and hyphens; a single word too long for the line is the only one split. */
.step-name {
  overflow-wrap: break-word;
}

.step-empty {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.step-empty {
  font-weight: 400;
  color: var(--color-on-surface-variant);
}

.step-height {
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-on-surface-variant);
}

.step-skeleton {
  width: 80%;
  height: 1.25em;
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
}

.status {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--spacing-md);
  row-gap: 2px;
  margin: 0;
  /* Two lines held: the instruction changes per step, the panel stays put. */
  min-height: 2.8em;
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.climb {
  display: inline-flex;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-base);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.climb--empty {
  color: var(--color-on-surface-variant);
  font-weight: 500;
}

.instruction {
  color: var(--color-on-surface-variant);
}

.route-hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.spacer {
  flex: 1;
}

/* Floating pill over the map, as in the picker: frosted and lifted, brand ring while typing. */
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
}

.search-field:focus-within {
  border-color: var(--color-primary);
  background-color: var(--color-background);
  box-shadow: var(--shadow-lg), var(--input-focus-ring);
}

.search-field :deep(.search-icon) {
  color: var(--color-primary);
}

.search-field :deep(.search-input::-webkit-search-cancel-button) {
  display: none;
}

.results-enter-active,
.results-leave-active {
  transform-origin: top center;
  transition:
    opacity var(--motion-duration-short) var(--motion-ease-standard),
    transform var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.results-enter-from,
.results-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--motion-offset))) scale(0.98);
}
</style>

<style>
/* While planning, a tap on a tour marker sets a point like anywhere else on the map. */
.route-planning .maplibregl-marker {
  pointer-events: none;
}
</style>
