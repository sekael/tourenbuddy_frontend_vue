import type { TrailOverlayId } from '@/features/map/data/trail-overlays'
import type { Trail } from '@/features/map/domain/entities/trail'
import type { TourType } from '@/features/tours/data/models/tour-type'
import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import { z } from 'zod'
import { TRAIL_OVERLAYS } from '@/features/map/data/trail-overlays'

const OVERLAYS_STORAGE_KEY = 'tb.map.overlays'

/** Persisted overlays, filtered to known ids so one stale entry doesn't wipe the rest. */
function readStoredOverlays(): TrailOverlayId[] {
  try {
    const parsed = z.array(z.string()).safeParse(JSON.parse(localStorage.getItem(OVERLAYS_STORAGE_KEY) ?? '[]'))
    if (parsed.success)
      return TRAIL_OVERLAYS.map(o => o.id).filter(id => parsed.data.includes(id))
  }
  catch {
    // localStorage unavailable or corrupt JSON — fall back to all off.
  }
  return []
}

/** Ski routes found by one tap, nearest first; `selectedId` null = list view. */
export interface TrailCard {
  candidates: Trail[]
  /** Hits beyond `candidates` (the "+N more" note). */
  more: number
  selectedId: string | null
}

/**
 * Transient handoff from the calendar route to the map page. The calendar lives
 * on its own route while tour detail is overlay state on `/map`, so a selection
 * or a return-to-list must survive one navigation. Set before `router.push`,
 * consumed once in the map page's `onMounted`, then dropped — it is deliberately
 * NOT a URL param (a bare `/map` deep link carrying these flags is meaningless).
 */
export interface PendingIntent {
  /** Open the tour-list overlay on arrival (calendar back button). */
  openTours?: boolean
  /** Select this tour and open its detail on arrival. */
  selectTourId?: string
  /** Which calendar view the selection came from, so detail-back can return. */
  origin?: 'cal-seasons' | 'cal-planned'
  /**
   * Planned view only: the `dayKey` of the cell the detail was opened from. For a
   * multi-day tour that is not necessarily its start day, so detail-back re-opens the
   * day the user was on — provided the tour's span still covers it.
   */
  originDay?: string
  /** Auto-start the calendar tour on arrival: the map tour just ran to completion. */
  startCalendarTour?: boolean
}

export const useMapStore = defineStore('map', () => {
  const isPickingLocation = ref(false)
  /** On-canvas rectangle-draw mode for selecting an offline map region. */
  const isDrawingRegion = ref(false)
  const currentStyleIndex = ref(0)
  const selectedTourId = ref<string | null>(null)
  /** Tentative goal coordinates shown as a lighter-tone preview marker while editing or creating a tour. */
  const previewGoal = ref<{ lng: number, lat: number } | null>(null)
  /** Activity type driving the preview marker's lighter shade; null → neutral fallback color. */
  const previewTourType = ref<TourType | null>(null)
  /** Re-picked, not-yet-saved start/end coordinates shown as lighter-tone draft detail markers. */
  const previewStart = ref<{ lng: number, lat: number } | null>(null)
  const previewEnd = ref<{ lng: number, lat: number } | null>(null)
  /** One-shot cross-route intent from the calendar (see PendingIntent). */
  const pendingIntent = ref<PendingIntent | null>(null)
  /** Visible trail overlays, kept in draw order; persisted per device. */
  const activeOverlays = ref<TrailOverlayId[]>(readStoredOverlays())
  const trailCard = ref<TrailCard | null>(null)
  /** Ski routes in view that carry route info: marked on the map, and tappable. */
  const clickableTrails = shallowRef<Trail[]>([])

  watch(activeOverlays, (ids) => {
    try {
      localStorage.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify(ids))
    }
    catch {
      // Not persisted this time; the in-memory choice still applies.
    }
  })

  function toggleOverlay(id: TrailOverlayId) {
    const next = new Set(activeOverlays.value)
    if (!next.delete(id))
      next.add(id)
    activeOverlays.value = TRAIL_OVERLAYS.map(o => o.id).filter(i => next.has(i))
  }

  /** One hit opens its details directly; several open the list. */
  function showTrails(candidates: Trail[], more: number) {
    trailCard.value = { candidates, more, selectedId: candidates.length === 1 ? candidates[0]!.id : null }
  }

  function selectTrail(id: string | null) {
    if (trailCard.value)
      trailCard.value = { ...trailCard.value, selectedId: id }
  }

  function clearTrails() {
    trailCard.value = null
  }

  function setClickableTrails(trails: Trail[]) {
    clickableTrails.value = trails
  }

  function setPendingIntent(intent: PendingIntent) {
    pendingIntent.value = intent
  }

  /** Returns the pending intent (if any) and clears it — read exactly once. */
  function consumePendingIntent(): PendingIntent | null {
    const intent = pendingIntent.value
    pendingIntent.value = null
    return intent
  }

  function setPickingLocation(picking: boolean) {
    isPickingLocation.value = picking
  }

  function setDrawingRegion(drawing: boolean) {
    isDrawingRegion.value = drawing
  }

  function setStyleIndex(index: number) {
    currentStyleIndex.value = index
  }

  function selectTour(tourId: string | null) {
    selectedTourId.value = tourId
  }

  function setPreviewGoal(goal: { lng: number, lat: number } | null) {
    previewGoal.value = goal
  }

  function setPreviewTourType(tourType: TourType | null) {
    previewTourType.value = tourType
  }

  function setPreviewStart(start: { lng: number, lat: number } | null) {
    previewStart.value = start
  }

  function setPreviewEnd(end: { lng: number, lat: number } | null) {
    previewEnd.value = end
  }

  return {
    isPickingLocation,
    isDrawingRegion,
    currentStyleIndex,
    selectedTourId,
    previewGoal,
    previewTourType,
    previewStart,
    previewEnd,
    pendingIntent,
    activeOverlays,
    trailCard,
    clickableTrails,
    toggleOverlay,
    showTrails,
    selectTrail,
    clearTrails,
    setClickableTrails,
    setPendingIntent,
    consumePendingIntent,
    setPickingLocation,
    setDrawingRegion,
    setStyleIndex,
    selectTour,
    setPreviewGoal,
    setPreviewTourType,
    setPreviewStart,
    setPreviewEnd,
  }
})
