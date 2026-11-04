<script setup lang="ts">
import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent, PaddingOptions, Point } from 'maplibre-gl'
import type { LocationResult } from '@/features/map/data/services/swisstopo-search-service'
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { PlannedPoint, RoutePlan, RoutePoints, RouteStep } from '@/features/map/domain/route-plan'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { useElementSize, useEventListener, usePreferredReducedMotion, watchDebounced } from '@vueuse/core'
import { LngLatBounds } from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowReactive, shallowRef, useTemplateRef, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import SearchInput from '@/core/components/search-input.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { pace } from '@/core/composables/use-pace'
import { useSheetInset } from '@/core/composables/use-sheet-inset'
import { isOnline } from '@/core/offline/use-online-status'
import { nextStep, ROUTE_STEPS, routeClimb } from '@/features/map/domain/route-plan'
import { snapNetworkFor } from '@/features/map/domain/snap-network'
import { FLIGHT_SPEED, frameBounds, isBoundsVisible, TOUR_ZOOM } from '@/features/map/presentation/composables/frame-tour'
import { isGap, legHandle, skiTilesTemplate, STOP_SNAP_M, tapSnapM, useLegRouter } from '@/features/map/presentation/composables/use-leg-router'
import { useLocationSearch } from '@/features/map/presentation/composables/use-location-search'
import { profileMetrics } from '@/features/map/presentation/composables/use-track-drawing'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { getElevation } from '@/features/tours/data/services/swisstopo-elevation-service'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'
import { getTrackProfile } from '@/features/tours/data/services/swisstopo-profile-service'
import { tourMinutes } from '@/features/tours/domain/route-metrics'
import RouteNumbers from '@/features/tours/presentation/components/route-numbers.vue'
import LocationSearchResults from './location-search-results.vue'
import { useTrackDrawLayer } from './track-draw-layer'

/**
 * The route step of a tour's creation (map-first-tour-creation D1, D8–D10, D13–D14): start → goal →
 * end set in order by a tap on the map or a search result, each named and measured at once, any of
 * them dragged to move it. The legs between them follow the ways the map shows (or go straight, the
 * user's choice), and that line is the tour's track: a leg's middle handle pulls out a point between
 * the stops to shape it, as the track drawer's does, and a drawing it is handed keeps its own way and
 * its points. The numbers — distance, time, climb, descent — come from the terrain under the line. A
 * trip's days switch right here, and "+ Next day" plans the one after. On a phone the panel folds down
 * to its summary, for more map.
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
  /** The stage's drawing, its goal marked (read once): its way and its points between the stops stay. */
  track?: DrawnTrack | null
  /** An uploaded track the stage keeps as it is: nothing to follow, its own numbers. */
  fixedLine?: LngLat[] | null
  /** The stage's activities: what the legs follow, and how the time is reckoned. */
  tourTypes?: readonly TourType[]
  /** The trip's days by label, this one at `day`: from two on, the panel switches between them. */
  days?: readonly string[]
  day?: number
  /** The trip's last day: "+ Next day" plans the one after it. */
  canAddDay?: boolean
  /** A form is behind the step: leaving goes back to it (an arrow), not out of the tour (a cross). */
  back?: boolean
}>()

const emit = defineEmits<{
  change: [points: RoutePoints]
  /** The line the map draws: along the ways, the uploaded track, or null for straight legs. */
  line: [line: LngLat[] | null]
  done: [plan: RoutePlan]
  nextDay: [plan: RoutePlan]
  selectDay: [index: number, plan: RoutePlan]
  cancel: []
}>()

/** The legs follow the ways (else straight lines); the page holds it across the trip's days. */
const follow = defineModel<boolean>('follow', { default: true })
/** On a phone, the panel folded down to its summary (D14); the page holds it across the days too. */
const compact = defineModel<boolean>('compact', { default: false })

const { t, locale } = useI18n({ useScope: 'global' })
const { formatElevation } = useFormatter()
const reducedMotion = usePreferredReducedMotion()
const { activeOverlays } = storeToRefs(useMapStore())

const points = reactive<RoutePoints>({ ...props.initial })
const active = ref<RouteStep>(props.step)
/** × with points set and no form behind would lose them: it asks first, like the form's ×. */
const confirmingClose = ref(false)
function close() {
  if (!props.back && ROUTE_STEPS.some(kind => points[kind]))
    confirmingClose.value = true
  else
    emit('cancel')
}
/** A drawing's points between the stops: on the way up (start → goal) and down (goal → end). */
const vias = shallowRef<{ up: LngLat[], down: LngLat[] }>((() => {
  const track = props.track
  if (track?.goal == null)
    return { up: [], down: [] }
  return { up: track.points.slice(1, track.goal), down: track.points.slice(track.goal + 1, -1) }
})())
/** A point held under the finger: its legs wait until it is let go. */
const dragging = ref(false)
watch(points, p => emit('change', { ...p }), { immediate: true })
// A point handed over still unnamed (the next day starting at a goal) is looked up like a new one.
onMounted(() => ROUTE_STEPS.forEach((step) => {
  const p = points[step]
  if (p?.loading)
    place(step, p.location)
}))
/** A day's route opens framed this close at most: its hut and its pass, not the whole valley. */
const OPEN_ZOOM = 14
// The points it opens with (the next day's start, the form's route) fill the view beside the panel.
onMounted(() => frameRoute(null, Math.max(props.map?.getZoom() ?? 0, OPEN_ZOOM), true))

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
  // The points of a drawing on the way up (or down) go with the start (or end) they led from.
  if (step === 'start')
    vias.value = { ...vias.value, up: [] }
  else if (step === 'end')
    vias.value = { ...vias.value, down: [] }
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
function frameRoute(at: { lng: number, lat: number } | null, zoom: number, always = false) {
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
    if (always || !isBoundsVisible(map, bounds, covered))
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

// ── Legs along the ways (D8) ─────────────────────────────────────────────────
const network = computed(() => snapNetworkFor(activeOverlays.value, props.tourTypes ?? []))
const router = useLegRouter({ network: () => network.value, skiTemplate: () => skiTilesTemplate(props.map), maxTiles: 64 })
const fixed = !!props.fixedLine?.length
const mode = computed<'follow' | 'straight' | 'fixed'>(() => (fixed ? 'fixed' : follow.value ? 'follow' : 'straight'))

const at = (p: PlannedPoint): LngLat => [p.location.lng, p.location.lat]
const pairKey = (a: LngLat, b: LngLat) => `${a.join(',')}|${b.join(',')}`
/** The drawing's legs, kept as drawn while their two points stay; then each leg routed so far, per network. */
const given = new Map((props.track?.legs ?? []).map((leg, i) => [pairKey(props.track!.points[i]!, props.track!.points[i + 1]!), leg]))
const routed = shallowReactive(new Map<string, LngLat[]>())
const routedKey = (a: LngLat, b: LngLat) => `${network.value ?? 'ways'}|${pairKey(a, b)}`
function legOf(a: LngLat, b: LngLat): LngLat[] | null {
  if (a[0] === b[0] && a[1] === b[1])
    return [a, b]
  return given.get(pairKey(a, b)) ?? routed.get(routedKey(a, b)) ?? null
}

/** The route's stops in order, the goal's place among them; none before there is a goal. */
const route = computed(() => {
  const { start, goal, end } = points
  if (!goal)
    return null
  const up = start ? vias.value.up : []
  const stops = [...(start ? [at(start), ...up] : []), at(goal), ...(end ? [...vias.value.down, at(end)] : [])]
  return { stops, goal: start ? 1 + up.length : 0 }
})
const pairs = computed(() => route.value?.stops.slice(1).map((b, i) => [route.value!.stops[i]!, b] as const) ?? [])
/** Legs still to route: none while the route goes straight or keeps its upload. */
const pending = computed(() => (mode.value === 'follow' ? pairs.value.filter(([a, b]) => !legOf(a, b)) : []))
const settled = computed(() => pending.value.length === 0)

let routing = false
let alive = true
onBeforeUnmount(() => (alive = false))
async function routeLegs() {
  if (routing)
    return
  routing = true
  try {
    let next = pending.value[0]
    while (next && !dragging.value) {
      const [a, b] = next
      const key = routedKey(a, b)
      const leg = await router.between(a, b, STOP_SNAP_M).catch(() => [a, b])
      if (!alive)
        return
      routed.set(key, leg)
      next = pending.value[0]
    }
  }
  finally {
    routing = false
  }
}
watch([pending, dragging], () => void routeLegs(), { immediate: true })

/** A leg the ways didn't lead along (a point far off them): it goes straight, and the panel says so. */
const gap = computed(() => mode.value === 'follow' && pairs.value.some(([a, b]) => isGap(routed.get(routedKey(a, b)) ?? [])))

/** The line along the stops, a leg still loading straight meanwhile. */
const routeLine = computed<LngLat[] | null>(() => {
  if (pairs.value.length === 0)
    return null
  return pairs.value.flatMap(([a, b], i) => {
    const leg = legOf(a, b) ?? [a, b]
    return i === 0 ? leg : leg.slice(1)
  })
})
const shownLine = computed(() => (mode.value === 'fixed' ? props.fixedLine! : mode.value === 'follow' ? routeLine.value : null))
watch(shownLine, line => emit('line', line), { immediate: true })

// ── Shaping the line: points between the stops (D13) ────────────────────────
/** The route's stops that are points between (not its start, goal or end), by their index; none going straight. */
const viaIndices = computed(() => {
  const r = route.value
  if (!r || mode.value !== 'follow')
    return []
  return r.stops.flatMap((_, i) => (i > 0 && i < r.stops.length - 1 && i !== r.goal ? [i] : []))
})

/** The points between spliced at the route's stop `index`: on the way up before the goal, down after it. */
function spliceVias(index: number, drop: number, ...add: LngLat[]) {
  const goal = route.value?.goal ?? 0
  const side = index <= goal ? 'up' : 'down'
  const list = [...vias.value[side]]
  list.splice(side === 'up' ? index - 1 : index - goal - 1, drop, ...add)
  vias.value = { ...vias.value, [side]: list }
}

/** The map's zoom, for the handles: a leg too short on screen has none. */
const zoom = ref(props.map?.getZoom() ?? 0)
const onZoom = () => (zoom.value = props.map!.getZoom())
/** Each leg's handle to pull a point out of, once the leg follows its way; none while a point is held. */
const handles = computed(() => (mode.value === 'follow' && !dragging.value
  ? pairs.value.map(([a, b]) => {
      const leg = legOf(a, b)
      return leg && legHandle(leg, zoom.value)
    })
  : []))

// The points between and the handles as the drawer draws them; the page draws the line and the stops.
let editLayer: ReturnType<typeof useTrackDrawLayer> | null = null
function drawEdits() {
  const r = route.value
  editLayer?.update({ points: viaIndices.value.length ? r!.stops : [], legs: [], goal: r?.goal }, [], handles.value)
}
watch([viaIndices, handles], drawEdits)
onMounted(() => {
  if (!props.map)
    return
  editLayer = useTrackDrawLayer(props.map, 'route-plan-edit')
  editLayer.setup()
  drawEdits()
  props.map.on('zoom', onZoom)
})
onBeforeUnmount(() => {
  props.map?.off('zoom', onZoom)
  editLayer?.remove()
})

// ── Gestures: a tap sets the active point, a press on a point (or a leg's handle) drags it ──
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

/** What a press takes hold of: a stop, a point between two of them (its index among the route's stops), or a leg's handle. */
type Grab = { kind: 'stop', step: RouteStep } | { kind: 'via', index: number } | { kind: 'handle', leg: number }

/** What lies under `spot` within fingertip reach: a stop first (the places), then a point between, then a handle. */
function grabAt(spot: Point): Grab | null {
  const nearest = (spots: readonly (LngLat | null)[]) => {
    let best = -1
    let bestDistance = coarse() ? 24 : 12
    spots.forEach((p, i) => {
      const d = p ? props.map!.project(p).dist(spot) : Infinity
      if (d <= bestDistance) {
        best = i
        bestDistance = d
      }
    })
    return best
  }
  const stop = nearest(ROUTE_STEPS.map(step => points[step] && at(points[step]!)))
  if (stop >= 0)
    return { kind: 'stop', step: ROUTE_STEPS[stop]! }
  const stops = route.value?.stops ?? []
  const via = nearest(stops.map((p, i) => (viaIndices.value.includes(i) ? p : null)))
  if (via >= 0)
    return { kind: 'via', index: via }
  const handle = nearest(handles.value)
  return handle >= 0 ? { kind: 'handle', leg: handle } : null
}

let drag: { grab: Grab, from: Point, to: LngLat | null } | null = null
/** A drag ends in a click event too; that one must not set a point. */
let dragged = false

function onClick(e: MapMouseEvent) {
  if (dragged) {
    dragged = false
    return
  }
  const hit = grabAt(e.point)
  if (hit?.kind === 'stop')
    active.value = hit.step
  // A tap on a point between takes it out: the leg runs straight on along the ways.
  else if (hit?.kind === 'via')
    spliceVias(hit.index, 1)
  // On a leg's handle it was a grab, not a new point.
  else if (!hit && !props.routeHit?.(e.point))
    setAndAdvance(active.value, { lng: e.lngLat.lng, lat: e.lngLat.lat })
}

function onPress(e: MapMouseEvent | MapTouchEvent) {
  if ('touches' in e.originalEvent && e.originalEvent.touches.length > 1)
    return
  const hit = grabAt(e.point)
  if (!hit)
    return
  // Holds the map still: this gesture moves the point, not the map.
  e.preventDefault()
  drag = { grab: hit, from: e.point, to: null }
}

function onMove(e: MapMouseEvent | MapTouchEvent) {
  if (!drag) {
    if (!coarse())
      props.map!.getCanvas().style.cursor = grabAt(e.point) ? 'grab' : 'crosshair'
    return
  }
  // Under 4 px it is a tap on the point, not a drag.
  if (!drag.to && e.point.dist(drag.from) < 4)
    return
  const to: LngLat = [e.lngLat.lng, e.lngLat.lat]
  drag.to = to
  dragging.value = true
  const { grab } = drag
  if (grab.kind === 'stop') {
    const p = points[grab.step]
    if (p)
      points[grab.step] = { ...p, location: { lng: to[0], lat: to[1] } }
  }
  else if (grab.kind === 'via') {
    spliceVias(grab.index, 1, to)
  }
  else {
    // Pulled out of its leg: from here on a point between, moved like one.
    spliceVias(grab.leg + 1, 0, to)
    drag.grab = { kind: 'via', index: grab.leg + 1 }
  }
}

function onRelease() {
  const held = drag
  drag = null
  if (!held?.to) {
    dragging.value = false
    return
  }
  dragged = true
  // A touch drag fires no click to reset it.
  setTimeout(() => (dragged = false), 0)
  const { grab, to } = held
  if (grab.kind === 'via') {
    void land(grab.index, to)
    return
  }
  if (grab.kind === 'stop') {
    active.value = grab.step
    // Elsewhere now: named and measured again, as a new tap would be.
    place(grab.step, { lng: to[0], lat: to[1] })
  }
  dragging.value = false
}

/**
 * A point between let go lands on the way the leg before it reaches there, as a point dragged in
 * the drawer does — a stop is a place and stays where it was set, a point between only says which
 * way — and that leg is the one it came by; the leg on follows the ways from there.
 */
async function land(index: number, spot: LngLat) {
  const before = route.value!.stops[index - 1]!
  const radius = tapSnapM(spot[1], props.map?.getZoom() ?? TOUR_ZOOM, coarse())
  const { to, line } = await router.resolve(before, spot, radius).catch(() => ({ to: spot, line: null }))
  // Moved again, or taken out, meanwhile: that stands.
  if (alive && route.value?.stops[index] === spot) {
    if (line && !isGap(line))
      routed.set(routedKey(before, to), line)
    spliceVias(index, 1, to)
  }
  dragging.value = false
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
  if (listOpen.value)
    listOpen.value = false
  else if (confirmingClose.value)
    confirmingClose.value = false
  else
    close()
  e.preventDefault()
}, { capture: true })

// ── Numbers ─────────────────────────────────────────────────────────────────
/**
 * Distance, time, climb and descent of the line, from the terrain under it: held while a leg
 * loads (no blank in between, no guess) and changed once, to the final numbers. Going straight,
 * the climb comes from the points' heights.
 */
const lineNumbers = shallowRef<{ metrics: RouteMetrics, minutes: number | null } | null>(null)
let measuring = 0
watchDebounced(() => [mode.value, settled.value, shownLine.value] as const, async ([m, done, line]) => {
  const run = ++measuring
  if (m === 'straight' || !line) {
    lineNumbers.value = null
    return
  }
  if (!done)
    return
  const profile = await getTrackProfile(line).catch(() => null)
  if (run !== measuring)
    return
  const metrics = profileMetrics(line, profile)
  lineNumbers.value = { metrics, minutes: profile && tourMinutes(metrics, { tourTypes: props.tourTypes ?? [] }, pace.value) }
}, { debounce: 300, immediate: true })

const climb = ref(routeClimb(points))
watchEffect(() => {
  if (!ROUTE_STEPS.some(step => points[step]?.loading))
    climb.value = routeClimb(points)
})
const numbers = computed(() => {
  if (mode.value !== 'straight')
    return lineNumbers.value
  return climb.value && { metrics: { distance: null, ...climb.value }, minutes: null }
})
/** The line is there, its numbers on their way. */
const measuringLine = computed(() => !numbers.value && !!shownLine.value)

// ── Panel ───────────────────────────────────────────────────────────────────
const STEP_ICONS: Record<RouteStep, string> = { start: 'trip_origin', goal: 'flag', end: 'sports_score' }

/** What to do next: set the point at hand, else shape the line along the ways. */
const instruction = computed(() => {
  if (!points[active.value])
    return t(`map.plan.hint.${active.value}`)
  if (viaIndices.value.length)
    return t('map.plan.hint.via')
  return mode.value === 'follow' && pairs.value.length ? t('map.plan.hint.shape') : t('map.plan.hint.move')
})

/** A leg is on its way along the ways (not while a point is held: it waits to be let go). */
const finding = computed(() => !settled.value && !dragging.value)

/** What the legs follow, in words — or that a leg is on its way, or found none. */
const followStatus = computed(() => {
  if (mode.value === 'fixed')
    return t('map.plan.follow.fixed')
  if (mode.value === 'straight')
    return t('map.plan.follow.straight')
  if (router.issue.value === 'unavailable')
    return t('map.plan.follow.unavailable')
  if (finding.value)
    return t('map.plan.follow.finding')
  if (gap.value)
    return t('map.plan.follow.gap')
  return t(`map.plan.follow.${network.value ?? 'ways'}`)
})
/** Folded, the summary says what the folded row would: a leg on its way, or a way not found. */
const followNews = computed(() => mode.value === 'follow' && (router.issue.value === 'unavailable' || finding.value || gap.value))

function currentPlan(): RoutePlan {
  const r = route.value
  const track = mode.value === 'follow' && r && r.stops.length > 1
    ? { points: r.stops, legs: pairs.value.map(([a, b]) => legOf(a, b) ?? [a, b]), goal: r.goal }
    : null
  return { points: { ...points }, track }
}

/** Leaving the step waits for the legs still loading: the track handed on is the one shown. */
const waiting = shallowRef<((plan: RoutePlan) => void) | null>(null)
function finish(then: (plan: RoutePlan) => void) {
  if (settled.value)
    then(currentPlan())
  else
    waiting.value = then
}
watch(settled, (done) => {
  const then = waiting.value
  if (done && then) {
    waiting.value = null
    then(currentPlan())
  }
})

// On a phone the panel is a bottom sheet: bottom toasts (`--sheet-inset`) rise above its buttons,
// and the camera frames above it. Docked left on desktop, it leaves the centred toasts clear.
const publishInset = useSheetInset()
watchEffect(() => publishInset(isDesktop.value ? 0 : height.value))

// ── Folding the sheet (phone, D14) ──────────────────────────────────────────
// Its grip, or its head, pulled down folds the points' rows away for more map — the day, the numbers
// and the buttons stay — and pulled up (or the grip tapped) unfolds them; a flick goes all the way.
const foldBody = useTemplateRef<HTMLElement>('foldBody')
const { height: foldNatural } = useElementSize(foldBody, undefined, { box: 'border-box' })
const foldable = computed(() => !isDesktop.value)
const folded = computed(() => foldable.value && compact.value)
/** The rows' height while a finger pulls the sheet; null at rest. */
const pulled = ref<number | null>(null)
const FLICK = 0.5
let pull: { y: number, from: number, prev: { y: number, t: number }, last: { y: number, t: number } } | null = null
/** A pull ends in a click on the grip too; that one must not toggle it back. */
let pulledNow = false

function onPullStart(e: PointerEvent) {
  if (!foldable.value || (e.target as Element).closest('button:not(.grip), a, input'))
    return
  const mark = { y: e.clientY, t: e.timeStamp }
  pull = { y: e.clientY, from: folded.value ? 0 : foldNatural.value, prev: mark, last: mark }
}

function onPullMove(e: PointerEvent) {
  if (!pull)
    return
  const dy = e.clientY - pull.y
  if (pulled.value == null) {
    // Under 4 px it is a tap; a sideways swipe scrolls the days.
    if (Math.abs(dy) < 4)
      return
    const top = e.currentTarget as HTMLElement
    top.setPointerCapture(e.pointerId)
  }
  pulled.value = Math.min(foldNatural.value, Math.max(0, pull.from - dy))
  pull.prev = pull.last
  pull.last = { y: e.clientY, t: e.timeStamp }
}

function onPullEnd(e: PointerEvent) {
  const p = pull
  pull = null
  if (!p || pulled.value == null)
    return
  // A release still moving fast goes on that way; a resting one settles where nearer.
  const dt = p.last.t - p.prev.t
  const velocity = dt > 0 && e.timeStamp - p.last.t < 100 ? (p.last.y - p.prev.y) / dt : 0
  compact.value = Math.abs(velocity) > FLICK ? velocity > 0 : pulled.value < foldNatural.value / 2
  pulled.value = null
  pulledNow = true
  setTimeout(() => (pulledNow = false), 0)
}

function toggleFold() {
  if (!pulledNow)
    compact.value = !compact.value
}

/** The rows glide to their height, follow the finger, or fold to none; measured first, so never a jump. */
const foldStyle = computed(() => {
  if (!foldable.value || (!foldNatural.value && !folded.value))
    return undefined
  return { height: `${pulled.value ?? (folded.value ? 0 : foldNatural.value)}px` }
})
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
      <div class="top" @pointerdown="onPullStart" @pointermove="onPullMove" @pointerup="onPullEnd" @pointercancel="onPullEnd">
        <button
          v-if="foldable" type="button" class="grip" :aria-expanded="!folded" aria-controls="planner-fold"
          :aria-label="folded ? t('map.plan.unfold') : t('map.plan.fold')" data-testid="planner-grip" @click="toggleFold"
        >
          <span class="grip-bar" />
        </button>
        <header class="head">
          <BaseIconButton
            v-if="back" name="arrow_back" variant="tonal" :label="t('map.plan.back')" data-testid="planner-cancel"
            @click="emit('cancel')"
          />
          <nav v-if="days && days.length > 1" class="days" :aria-label="t('tours.creation.daysLabel')" data-testid="planner-days">
            <button
              v-for="(label, i) in days" :key="i" type="button" class="day" :class="{ 'day--active': i === day }"
              :aria-current="i === day ? 'step' : undefined" :data-testid="`planner-day-${i}`"
              @click="i !== day && finish(plan => emit('selectDay', i, plan))"
            >
              {{ label }}
            </button>
          </nav>
          <h2 v-else class="title">
            {{ title }}
          </h2>
          <BaseIconButton v-if="!back" name="close" variant="tonal" :label="t('tours.picker.cancelBtn')" data-testid="planner-cancel" @click="close" />
        </header>
      </div>

      <div v-if="confirmingClose" class="discard" role="alertdialog" aria-labelledby="planner-discard-title" data-testid="planner-discard">
        <p id="planner-discard-title" class="discard-text">
          <BaseIcon name="warning" class="discard-icon" />
          {{ t('tours.creation.discard') }}
        </p>
        <div class="discard-actions">
          <BaseButton type="button" variant="secondary" size="sm" data-testid="planner-discard-keep" @click="confirmingClose = false">
            {{ t('tours.creation.keepEditing') }}
          </BaseButton>
          <BaseButton type="button" variant="danger" size="sm" data-testid="planner-discard-confirm" @click="emit('cancel')">
            {{ t('contacts.shared.discardBtn') }}
          </BaseButton>
        </div>
      </div>

      <div id="planner-fold" class="fold" :class="{ 'fold--pulled': pulled != null }" :style="foldStyle" :inert="folded">
        <div ref="foldBody" class="fold-body">
          <ol class="stops" :aria-label="t('map.plan.stepsLabel')">
            <li
              v-for="kind in ROUTE_STEPS" :key="kind" class="stop"
              :class="{ 'stop--active': active === kind, 'stop--set': !!points[kind] }"
            >
              <button
                type="button" class="stop-main" :aria-pressed="active === kind" :data-testid="`planner-step-${kind}`"
                @click="active = kind"
              >
                <span class="stop-mark" aria-hidden="true"><BaseIcon :name="STEP_ICONS[kind]" size="sm" /></span>
                <span class="stop-label">{{ t(`map.plan.step.${kind}`) }}</span>
                <span v-if="points[kind]?.loading" class="stop-skeleton" aria-hidden="true" />
                <span v-else-if="points[kind]" class="stop-name">{{ points[kind]!.name || t('map.plan.unnamed') }}</span>
                <span v-else class="stop-empty">{{ kind === 'goal' ? t('map.plan.required') : t('map.plan.optional') }}</span>
                <span v-if="points[kind] && !points[kind]!.loading" class="stop-height">
                  {{ points[kind]!.elevation == null ? '' : formatElevation(points[kind]!.elevation!) }}
                </span>
              </button>
              <BaseIconButton
                v-if="kind !== 'goal' && points[kind]" name="close" size="sm" :data-testid="`planner-remove-${kind}`"
                :label="t('map.plan.removeStep', { step: t(`map.plan.step.${kind}`) })" @click="clear(kind)"
              />
              <BaseButton
                v-else-if="kind === 'end' && points.start" variant="text" size="sm" class="stop-action"
                data-testid="planner-roundTrip" @click="roundTrip"
              >
                <BaseIcon name="replay" size="sm" />
                {{ t('map.plan.roundTrip') }}
              </BaseButton>
              <BaseButton
                v-else-if="kind === 'start' && !points.start && active === 'start'" variant="text" size="sm"
                class="stop-action" data-testid="planner-skip" @click="skip"
              >
                {{ t('map.plan.skip') }}
              </BaseButton>
            </li>
          </ol>

          <p v-if="hint" class="route-hint">
            {{ hint }}
          </p>

          <div class="follow" :class="{ 'follow--off': mode !== 'follow', 'follow--gap': gap && !finding }" data-testid="planner-follow">
            <span v-if="mode === 'follow' && finding" class="follow-icon follow-spinner" aria-hidden="true" />
            <BaseIcon v-else :name="mode === 'follow' ? 'route' : 'timeline'" size="sm" class="follow-icon" />
            <span class="follow-text">{{ followStatus }}</span>
            <button
              v-if="mode !== 'fixed'" type="button" role="switch" class="switch" :aria-checked="follow"
              :aria-label="t('map.plan.follow.label')" data-testid="planner-follow-switch" @click="follow = !follow"
            >
              <span class="switch-thumb" />
            </button>
          </div>
        </div>
      </div>

      <p class="status" role="status">
        <span v-if="numbers" class="numbers" :class="{ 'numbers--stale': finding }" data-testid="planner-climb">
          <RouteNumbers :metrics="numbers.metrics" :minutes="numbers.minutes" />
        </span>
        <span v-else-if="measuringLine" class="numbers numbers--pending">{{ t('map.plan.measuring') }}</span>
        <span v-if="folded && followNews" class="instruction" :class="{ 'instruction--warn': !finding }" data-testid="planner-note">{{ followStatus }}</span>
        <span v-else class="instruction">{{ instruction }}</span>
      </p>

      <div class="actions">
        <BaseButton
          v-if="canAddDay" variant="secondary" :disabled="!points.goal || !!waiting" data-testid="planner-next-day"
          @click="finish(plan => emit('nextDay', plan))"
        >
          <BaseIcon name="add" />
          {{ t('map.plan.nextDay') }}
        </BaseButton>
        <span class="spacer" />
        <BaseButton
          variant="primary" :disabled="!points.goal || !!waiting" data-testid="planner-done"
          @click="finish(plan => emit('done', plan))"
        >
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

/* The sheet's grip and head: pulled down, the points' rows fold away; sideways, the days scroll. */
.top {
  display: flex;
  flex-direction: column;
  touch-action: pan-x;
}

.grip {
  display: grid;
  place-items: center;
  height: 20px;
  margin: calc(-1 * var(--spacing-xs)) calc(-1 * var(--spacing-md)) 0;
  border: 0;
  background: none;
  cursor: grab;
  touch-action: none;
}

.grip-bar {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-outline-variant);
}

.grip:focus-visible {
  outline: none;
}

.grip:focus-visible .grip-bar {
  box-shadow: var(--input-focus-ring);
}

/* The rows that fold: their gap to what follows is their own, so folded they leave none. */
.fold {
  margin-bottom: calc(-1 * var(--spacing-sm));
  overflow: hidden;
  transition: height var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.fold--pulled {
  transition: none;
}

.fold-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
}

@media (prefers-reduced-motion: reduce) {
  .fold {
    transition: none;
  }
}

.head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 44px;
}

.discard {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-error-container) 70%, var(--color-background));
}

.discard-text {
  display: flex;
  gap: var(--spacing-xs);
  margin: 0;
  font-weight: var(--font-weight-medium);
}

.discard-icon {
  flex: none;
  color: var(--color-error);
}

.discard-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
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

/* The trip's days as pills, scrolling sideways past a handful. */
.days {
  display: flex;
  flex: 1;
  gap: var(--spacing-xs);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.day {
  flex: none;
  min-height: 36px;
  padding: 0 var(--spacing-md);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  cursor: pointer;
}

.day--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-semibold);
}

/* Start, goal, end as a route: one row each, their marks joined by a dotted line. */
.stops {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stop {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  border-radius: var(--radius-md);
}

.stop::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  /* Through the marks' middle: the row's padding plus half a mark. */
  left: calc(var(--spacing-sm) + 11px);
  border-left: 2px dotted var(--color-outline-variant);
}

.stop:first-child::before {
  top: 22px;
}

.stop:last-child::before {
  bottom: auto;
  height: 22px;
}

.stop--active {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
}

.stop-main {
  display: grid;
  flex: 1;
  grid-template-columns: 24px 3.25rem minmax(0, 1fr) auto;
  align-items: center;
  column-gap: var(--spacing-sm);
  min-width: 0;
  min-height: 44px;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 0;
  background: none;
  color: var(--color-on-surface);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.stop-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  /* Covers the dotted line where it passes. */
  background: var(--color-background);
  color: var(--color-on-surface-variant);
}

.stop--active .stop-mark {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
}

.stop--set .stop-mark,
.stop--active .stop-mark {
  color: var(--color-primary);
}

.stop-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
}

.stop--active .stop-label {
  color: var(--color-primary);
}

/* Breaks at spaces and hyphens: "Meiringen (Luftseilbahn)" reads whole, never cut. */
.stop-name {
  overflow-wrap: break-word;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

.stop-empty {
  overflow: hidden;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-height {
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-on-surface-variant);
}

.stop-skeleton {
  width: 80%;
  height: 1.25em;
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
}

.stop-action {
  flex: none;
  margin-right: var(--spacing-xxs);
}

.stop > :deep(.base-icon-button) {
  flex: none;
  margin-right: var(--spacing-xxs);
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

.numbers {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Held while a leg finds its way: the numbers still stand, fainter, until the new ones come. */
.numbers--stale {
  opacity: 0.5;
  transition: opacity var(--motion-duration-short) var(--motion-ease-standard);
}

.numbers--pending {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.instruction {
  color: var(--color-on-surface-variant);
}

.instruction--warn {
  color: var(--color-warning-text);
}

.route-hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

/* What the line follows, and the switch to straight lines. */
.follow {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 36px;
  padding: 0 var(--spacing-xxs) 0 var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
  font-size: var(--font-size-sm);
}

.follow-icon {
  flex: none;
  color: var(--color-primary);
}

/* A leg on its way: the icon turns while it loads. */
.follow-spinner {
  width: 16px;
  height: 16px;
  margin: 1px;
  border: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: follow-spin 0.9s linear infinite;
}

@keyframes follow-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .follow-spinner {
    animation: none;
  }
}

.follow--off .follow-icon {
  color: var(--color-on-surface-variant);
}

.follow--gap {
  background: color-mix(in srgb, var(--color-warning) 14%, var(--color-background));
}

.follow--gap .follow-icon {
  color: var(--color-warning-text);
}

.follow-text {
  flex: 1;
  min-width: 0;
}

.switch {
  position: relative;
  flex: none;
  width: 52px;
  height: 44px;
  border: 0;
  background: none;
  cursor: pointer;
}

/* The track; the thumb slides along it. */
.switch::before {
  content: '';
  position: absolute;
  inset: 11px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-outline-variant);
  transition: background var(--motion-duration-short) var(--motion-ease-standard);
}

.switch[aria-checked='true']::before {
  background: var(--color-primary);
}

.switch-thumb {
  position: absolute;
  top: 14px;
  left: 9px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-background);
  box-shadow: var(--shadow-sm);
  transition: transform var(--motion-duration-short) var(--motion-ease-standard);
}

.switch[aria-checked='true'] .switch-thumb {
  transform: translateX(18px);
}

.switch:focus-visible {
  outline: none;
}

.switch:focus-visible::before {
  box-shadow: var(--input-focus-ring);
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
