<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { buildMonthGrid, dayKey } from '@/features/calendar/domain/calendar-dates'
import { useAvailabilityStore } from '@/features/calendar/presentation/stores/availability-store'
import { TOUR_TYPE_COLORS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = defineProps<{ viewDate: Date }>()
const emit = defineEmits<{ select: [tourId: string] }>()

const { t, locale } = useI18n({ useScope: 'global' })

const toursStore = useToursStore()
const { tours, friendTours } = storeToRefs(toursStore)

const availabilityStore = useAvailabilityStore()
const { displayDays, editing } = storeToRefs(availabilityStore)

const listEl = ref<HTMLElement | null>(null)

interface DayEntry { tour: Tour, isFriend: boolean }

// Own planned tours + friend tours the viewer is a marked partner on. Anything
// without a planned date is dropped.
const entriesByDay = computed(() => {
  const map = new Map<string, DayEntry[]>()
  const add = (tour: Tour, isFriend: boolean) => {
    if (!tour.plannedDate)
      return
    const key = dayKey(tour.plannedDate)
    const bucket = map.get(key)
    if (bucket)
      bucket.push({ tour, isFriend })
    else
      map.set(key, [{ tour, isFriend }])
  }
  for (const tour of tours.value)
    add(tour, false)
  for (const tour of friendTours.value) {
    if (tour.isPartner)
      add(tour, true)
  }
  return map
})

const cells = computed(() => buildMonthGrid(props.viewDate))

// Desktop gets the spatial month grid; mobile gets a vertical day-tile list
// (see template). ≥600px is the app-wide desktop breakpoint.
const isDesktop = useIsDesktop()

// Localized Monday-first weekday headers, single-letter (`narrow`): the cells are
// too tight for the 2–3 char `short` form. 2024-01-01 is a Monday.
const weekdays = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)))
})

// Short weekday for the mobile list rows, where there's room for 2–3 chars.
const weekdayFmt = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short' }))
function weekdayLabel(date: Date): string {
  return weekdayFmt.value.format(date)
}

// Today's key, resolved once per mount — used to highlight the current day.
const todayKey = dayKey(new Date())

const MAX_PILLS = 2
function entriesFor(date: Date): DayEntry[] {
  return entriesByDay.value.get(dayKey(date)) ?? []
}

// One row per day of the visible month for the mobile list. Empty days are kept
// (they'll carry more per-day info later), so this is NOT the sparse tour list.
interface DayRow { date: Date, entries: DayEntry[], isToday: boolean }

// One row per in-month day, in calendar order. Empty days are kept.
const monthDays = computed<DayRow[]>(() =>
  cells.value
    .filter(cell => cell.inMonth)
    .map(cell => ({
      date: cell.date,
      entries: entriesFor(cell.date),
      isToday: dayKey(cell.date) === todayKey,
    })),
)

function scrollTodayIntoView() {
  listEl.value?.querySelector('.day-row--today')?.scrollIntoView({ block: 'start' })
}
defineExpose({ scrollTodayIntoView })

// ── Availability overlay + edit interaction ────────────────────────────────
function isAvailable(date: Date): boolean {
  return displayDays.value.has(dayKey(date))
}

// Selectable in edit mode: in-month and today-or-future (string compare is safe
// for YYYY-MM-DD). `todayKey` above is this component's local cutoff.
function isSelectable(date: Date, inMonth: boolean): boolean {
  return editing.value && inMonth && dayKey(date) >= todayKey
}

// Drag-to-select: the first day pressed fixes the direction (mark vs clear) for
// the whole gesture; every day the pointer enters gets the same direction. A
// plain tap is a one-day gesture, so it toggles.
const dragging = ref(false)
const dragMode = ref<'mark' | 'clear'>('mark')

function applyTo(date: Date, inMonth: boolean) {
  if (!isSelectable(date, inMonth))
    return
  const key = dayKey(date)
  const has = displayDays.value.has(key)
  if (dragMode.value === 'mark' ? !has : has)
    availabilityStore.toggleDay(key)
}

function onDayDown(event: PointerEvent, date: Date, inMonth: boolean) {
  if (!isSelectable(date, inMonth))
    return
  // Touch pointers get implicit capture on the origin cell, which stops
  // pointerenter firing on the days the finger slides over — so a swipe would
  // only mark the first day. Release it so the gesture hit-tests each cell.
  // (Mouse has no implicit capture, hence the guard: releasing throws otherwise.)
  const el = event.target as Element
  if (el.hasPointerCapture(event.pointerId))
    el.releasePointerCapture(event.pointerId)
  dragMode.value = displayDays.value.has(dayKey(date)) ? 'clear' : 'mark'
  dragging.value = true
  applyTo(date, inMonth)
}

function onDayEnter(date: Date, inMonth: boolean) {
  if (dragging.value)
    applyTo(date, inMonth)
}

function endDrag() {
  dragging.value = false
}
</script>

<template>
  <!-- Desktop: month grid — the spatial overview (weekend columns, free days). -->
  <div v-if="isDesktop" class="calendar">
    <div class="weekday-row">
      <div v-for="day in weekdays" :key="day" class="weekday">
        {{ day }}
      </div>
    </div>

    <div class="day-grid" @pointerup="endDrag" @pointerleave="endDrag" @pointercancel="endDrag">
      <div
        v-for="(cell, i) in cells"
        :key="i"
        class="day-cell"
        :class="{
          'day-cell--muted': !cell.inMonth,
          'day-cell--today': dayKey(cell.date) === todayKey,
          'day-cell--available': cell.inMonth && isAvailable(cell.date),
          'day-cell--selectable': isSelectable(cell.date, cell.inMonth),
        }"
        @pointerdown="onDayDown($event, cell.date, cell.inMonth)"
        @pointerenter="onDayEnter(cell.date, cell.inMonth)"
      >
        <span class="day-number">{{ cell.date.getDate() }}</span>
        <div v-if="cell.inMonth" class="pills">
          <button
            v-for="entry in entriesFor(cell.date).slice(0, MAX_PILLS)"
            :key="entry.tour.id"
            type="button"
            class="pill"
            :class="{ 'pill--friend': entry.isFriend }"
            @click="emit('select', entry.tour.id)"
          >
            <BaseIcon v-if="entry.tour.tourType" :name="TOUR_TYPE_ICONS[entry.tour.tourType]" size="xs" />
            <span class="pill-name">{{ entry.tour.name ?? t('tours.infoSheet.unnamedTour') }}</span>
          </button>
          <span v-if="entriesFor(cell.date).length > MAX_PILLS" class="pill-more">
            {{ t('calendar.planned.more', { count: entriesFor(cell.date).length - MAX_PILLS }) }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile: vertical day-tile list — every day a row (incl. empty), so tour
       chips have full width to be legible and free days stay visible. -->
  <ul v-else ref="listEl" class="day-list" @pointerup="endDrag" @pointerleave="endDrag" @pointercancel="endDrag">
    <li
      v-for="row in monthDays"
      :key="dayKey(row.date)"
      class="day-row"
      :class="{
        'day-row--today': row.isToday,
        'day-row--available': isAvailable(row.date),
        'day-row--selectable': isSelectable(row.date, true),
      }"
      @pointerdown="onDayDown($event, row.date, true)"
      @pointerenter="onDayEnter(row.date, true)"
    >
      <div class="day-head">
        <span class="day-weekday">{{ weekdayLabel(row.date) }}</span>
        <span class="day-num">{{ row.date.getDate() }}</span>
      </div>
      <div class="day-entries">
        <button
          v-for="entry in row.entries"
          :key="entry.tour.id"
          type="button"
          class="pill"
          :style="entry.tour.tourType ? { backgroundColor: TOUR_TYPE_COLORS[entry.tour.tourType] } : undefined"
          @click="emit('select', entry.tour.id)"
        >
          <BaseIcon v-if="entry.tour.tourType" :name="TOUR_TYPE_ICONS[entry.tour.tourType]" size="xs" />
          <span class="pill-name">{{ entry.tour.name ?? t('tours.infoSheet.unnamedTour') }}</span>
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--color-background);
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface);
}

.weekday {
  padding: var(--spacing-sm);
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.day-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(96px, 1fr);
  overflow-y: auto;
}

.day-cell {
  padding: var(--spacing-xs);
  border-right: 1px solid var(--color-outline-variant);
  border-bottom: 1px solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.day-cell--muted {
  background-color: var(--color-surface);
  opacity: 0.4;
}

/* Current day: darker border around the whole tile (outline avoids the layout
   shift a real border would add over the existing right/bottom borders) plus a
   light tint. Wins over the muted dim when today falls on an adjacent-month cell. */
.day-cell--today {
  outline: 1.5px solid var(--color-primary);
  outline-offset: -1.5px;
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
  opacity: 1;
}

/* Own availability: light-green background. After --today so it wins on a day
   that is both today and available. */
.day-cell--available {
  background-color: color-mix(in srgb, var(--color-success) 16%, transparent);
  opacity: 1;
}

/* Editable future day: pointer + suppress scroll/selection so drag marks a run. */
.day-cell--selectable {
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.day-number {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.pills {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.pill {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  min-width: 0;
}

.pill--friend {
  background-color: var(--color-friend);
}

.pill-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-more {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

/* ── Mobile day-tile list ────────────────────────────────────────────────── */
.day-list {
  height: 100%;
  overflow-y: auto;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background-color: var(--color-background);
}

.day-row {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  min-height: 48px;
  border-bottom: 1px solid var(--color-outline-variant);
}

/* The container's rounded border already closes the bottom edge — a last-row
   border would double it right against the corner. */
.day-row:last-child {
  border-bottom: none;
}

.day-row--today {
  outline: 1.5px solid var(--color-primary);
  outline-offset: -1.5px;
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
  /* Land below the container's rounded top corner when scrolled to, so the
     outline isn't clipped. scrollIntoView honours scroll-margin. */
  scroll-margin-top: var(--radius-md);
}

.day-row--available {
  background-color: color-mix(in srgb, var(--color-success) 16%, transparent);
}

.day-row--selectable {
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  flex-shrink: 0;
}

.day-weekday {
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.day-num {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

/* Stretch keeps pills full-width so tour names read in full. */
.day-entries {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-xxs);
  min-width: 0;
}
</style>
