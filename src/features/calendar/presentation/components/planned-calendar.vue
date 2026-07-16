<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { buildMonthGrid, dayKey } from '@/features/calendar/domain/calendar-dates'
import DayPreview from '@/features/calendar/presentation/components/day-preview.vue'
import { useAvailabilityStore } from '@/features/calendar/presentation/stores/availability-store'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import ContactActionMenu from '@/features/contacts/presentation/components/contact-action-menu.vue'
import { useContactFriendshipMap } from '@/features/contacts/presentation/composables/use-contact-friendship-map'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { TOUR_TYPE_COLORS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = defineProps<{
  viewDate: Date
  /**
   * Calendar-tour demo chips for the today cell. Non-null ONLY while the tour is
   * running (calendar-page gates it on `isRunning`). Rendered through a dedicated
   * branch, kept out of the real `entriesFor`/`friendsFor` path so demo data can
   * never surface outside the tour.
   */
  demoChips?: { entries: DayEntry[], friends: { userId: string, name: string }[] } | null
}>()
const emit = defineEmits<{
  // dayKey lets the page restore this day's detail list when the user navigates
  // back from the tour it opened.
  select: [tourId: string, dayKey?: string]
  editContact: [contactId: string]
}>()

const { t, locale } = useI18n({ useScope: 'global' })

const toursStore = useToursStore()
const { tours, friendTours } = storeToRefs(toursStore)

const availabilityStore = useAvailabilityStore()
const { displayDays, editing, friendDays } = storeToRefs(availabilityStore)

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

const friendshipsStore = useFriendshipsStore()
const { userIdToNamesMap } = storeToRefs(friendshipsStore)

// phone→userId map for the viewer's contacts (async-populated). Inverted below to
// resolve an availability row's userId back to the viewer's own contact card.
const { phoneToUserIdMap } = useContactFriendshipMap(contacts)

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

// Scroll the mobile day-list to a given row (no-op on the desktop grid, which
// has no list). Rows carry `data-day` = their dayKey.
function scrollDayIntoView(key: string) {
  listEl.value?.querySelector(`[data-day="${key}"]`)?.scrollIntoView({ block: 'start' })
}
function scrollTodayIntoView() {
  scrollDayIntoView(todayKey)
}
// Exposed so the page can re-open a day's detail list on back-navigation, with the
// mobile list scrolled to that day (so closing the sheet lands where it started).
function openDetailForDay(date: Date) {
  openDetail(date)
  nextTick(() => scrollDayIntoView(dayKey(date)))
}
defineExpose({ scrollTodayIntoView, openDetailForDay })

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

// Mobile: single-tap toggle only (no drag). `click` fires on a genuine tap but
// is suppressed when the touch turns into a scroll — so the day list stays
// scrollable in edit mode, unlike a pointerdown-driven gesture.
function onDayTap(date: Date) {
  if (!isSelectable(date, true))
    return
  availabilityStore.toggleDay(dayKey(date))
}

function hasContent(date: Date): boolean {
  return entriesFor(date).length > 0 || friendsFor(date).length > 0
}

// Desktop cell click opens the detail list in view mode only — edit-mode marking
// runs on pointer events (onDayDown), so a click here in edit mode is a no-op to
// avoid double-toggling.
function onCellActivate(date: Date, inMonth: boolean) {
  if (!editing.value && inMonth && hasContent(date))
    openDetail(date)
}

// Mobile row click: toggle availability while editing, otherwise open the detail
// list. (Mobile has no drag; the tap is the whole gesture.)
function onRowActivate(date: Date) {
  if (editing.value)
    onDayTap(date)
  else if (hasContent(date))
    openDetail(date)
}

// ── Friends' availability ──────────────────────────────────────────────────
/** One friend on one day. `contact` is null when only the profile name resolves. */
interface FriendChip { userId: string, name: string, contact: Contact | null }

// Invert phoneToUserIdMap → userId → Contact. Every friend is one of the viewer's
// contacts (enforced invariant), so this resolves a row's user_id to its card.
const contactByUserId = computed(() => {
  const map = new Map<string, Contact>()
  for (const contact of contacts.value) {
    for (const method of contact.contactMethods.filter(m => m.methodType === 'phone')) {
      const norm = normalizePhone(method.value)
      const uid = phoneToUserIdMap.value.get(norm.ok ? norm.e164 : method.value)
      if (uid && !map.has(uid))
        map.set(uid, contact)
    }
  }
  return map
})

// Fetch profile names for every friend userId in availability, so the fallback
// (unresolved-contact) chip has a name to show. getNamesByUserIds dedupes/caches.
watch(friendDays, (rows) => {
  const ids = [...new Set(rows.map(r => r.user_id))]
  if (ids.length > 0)
    friendshipsStore.getNamesByUserIds(ids)
}, { immediate: true })

// TODO(me): friendsByDay — dayKey → FriendChip[], the per-day friend list.
//   See task list at the end of this response.
const friendsByDay = computed<Map<string, FriendChip[]>>(() => {
  const mapByDay = new Map<string, Map<string, FriendChip>>()
  for (const ar of friendDays.value) {
    // Only consider today or future dates
    if (ar.date < todayKey) {
      continue
    }

    // Resolve name + contact, contact wins, profile name is fallback
    const contact = contactByUserId.value.get(ar.user_id)
    const profile = userIdToNamesMap.value.get(ar.user_id)
    let name = ''
    if (contact) {
      name = resolveContactName(contact)
    }
    else if (profile) {
      // firstName/lastName are both nullable — filter nulls so `name` is always a
      // string (a null here crashed the localeCompare sort below).
      name = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    }

    const chip: FriendChip = { userId: ar.user_id, name, contact: contact ?? null }

    const inner = mapByDay.get(ar.date)
    if (inner) {
      inner.set(ar.user_id, chip)
    }
    else {
      mapByDay.set(ar.date, new Map([[ar.user_id, chip]]))
    }
  }
  // Flatten each day's chips to name-sorted array
  const result = new Map<string, FriendChip[]>()
  for (const [day, inner] of mapByDay) {
    result.set(day, [...inner.values()].sort((a, b) => a.name.localeCompare(b.name)))
  }
  return result
})

function friendsFor(date: Date): FriendChip[] {
  return friendsByDay.value.get(dayKey(date)) ?? []
}

// ── Contact action menu (owned here; re-emit editContact to the page) ────────
const activeMenuContact = ref<Contact | null>(null)
const activeChipRect = ref<DOMRect | null>(null)

function openFriendMenu(chip: FriendChip, event: MouseEvent) {
  if (!chip.contact)
    return // unresolved: name-only, no actionable menu
  activeMenuContact.value = chip.contact
  activeChipRect.value = (event.currentTarget as HTMLElement).getBoundingClientRect()
}

function closeFriendMenu() {
  activeMenuContact.value = null
  activeChipRect.value = null
}

function handleEditContact(contactId: string) {
  closeFriendMenu()
  closeDetail()
  emit('editContact', contactId)
}

// ── Per-day detail list (tours first, then available friends) ────────────────
// A bottom sheet on mobile / dialog on desktop, layered over the calendar.
const detailDate = ref<Date | null>(null)
const detailEntries = computed(() => (detailDate.value ? entriesFor(detailDate.value) : []))
const detailFriends = computed(() => (detailDate.value ? friendsFor(detailDate.value) : []))
const detailLabel = computed(() =>
  detailDate.value
    ? new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(detailDate.value)
    : '',
)

function openDetail(date: Date) {
  detailDate.value = date
}
function closeDetail() {
  detailDate.value = null
}

// Tour row → open the tour (on the map), carrying the day so the page can
// re-open this detail list on back-navigation.
function selectFromDetail(tourId: string) {
  const day = detailDate.value ? dayKey(detailDate.value) : undefined
  closeDetail()
  emit('select', tourId, day)
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
        :data-tour="demoChips && dayKey(cell.date) === todayKey ? 'demo-chips' : undefined"
        @pointerdown="onDayDown($event, cell.date, cell.inMonth)"
        @pointerenter="onDayEnter(cell.date, cell.inMonth)"
        @click="onCellActivate(cell.date, cell.inMonth)"
      >
        <span class="day-number">{{ cell.date.getDate() }}</span>
        <!-- Preview only (non-interactive). The whole cell opens the detail list.
             Today, while the tour runs, shows the isolated demo chips instead. -->
        <DayPreview
          v-if="demoChips && dayKey(cell.date) === todayKey"
          :entries="demoChips.entries"
          :friends="demoChips.friends"
        />
        <DayPreview
          v-else-if="cell.inMonth"
          :entries="entriesFor(cell.date)"
          :friends="friendsFor(cell.date)"
        />
      </div>
    </div>
  </div>

  <!-- Mobile: vertical day-tile list — every day a row (incl. empty), so tour
       chips have full width to be legible and free days stay visible. -->
  <ul v-else ref="listEl" class="day-list">
    <li
      v-for="row in monthDays"
      :key="dayKey(row.date)"
      :data-day="dayKey(row.date)"
      class="day-row"
      :class="{
        'day-row--today': row.isToday,
        'day-row--available': isAvailable(row.date),
        'day-row--selectable': isSelectable(row.date, true),
      }"
      :data-tour="demoChips && row.isToday ? 'demo-chips' : undefined"
      @click="onRowActivate(row.date)"
    >
      <div class="day-head">
        <span class="day-weekday">{{ weekdayLabel(row.date) }}</span>
        <span class="day-num">{{ row.date.getDate() }}</span>
      </div>
      <!-- Preview only. The whole row opens the detail list (or toggles in edit mode).
           Today, while the tour runs, shows the isolated demo chips instead. -->
      <div class="day-entries">
        <DayPreview
          v-if="demoChips && row.isToday"
          :entries="demoChips.entries"
          :friends="demoChips.friends"
        />
        <DayPreview v-else :entries="row.entries" :friends="friendsFor(row.date)" />
      </div>
    </li>
  </ul>

  <!-- Per-day detail list: tours first, then available friends. Bottom sheet on
       mobile, dialog on desktop, over the calendar. -->
  <div v-if="detailDate" class="sheet-container">
    <AdaptiveOverlay :title="detailLabel" @close="closeDetail">
      <div class="detail-body">
        <template v-if="detailEntries.length">
          <h3 class="detail-heading">
            {{ t('calendar.planned.toursHeading') }}
          </h3>
          <button
            v-for="entry in detailEntries"
            :key="entry.tour.id"
            type="button"
            class="detail-row"
            @click="selectFromDetail(entry.tour.id)"
          >
            <BaseIcon
              v-if="entry.tour.tourType"
              :name="TOUR_TYPE_ICONS[entry.tour.tourType]"
              size="sm"
              :style="{ color: TOUR_TYPE_COLORS[entry.tour.tourType] }"
            />
            <span class="pill-name">{{ entry.tour.name ?? t('tours.infoSheet.unnamedTour') }}</span>
          </button>
        </template>
        <template v-if="detailFriends.length">
          <h3 class="detail-heading">
            {{ t('calendar.planned.friendsHeading') }}
          </h3>
          <button
            v-for="chip in detailFriends"
            :key="chip.userId"
            type="button"
            class="detail-row"
            :class="{ 'detail-row--static': !chip.contact }"
            @click="openFriendMenu(chip, $event)"
          >
            <BaseIcon name="person" size="sm" />
            <span class="pill-name">{{ chip.name }}</span>
          </button>
        </template>
      </div>
    </AdaptiveOverlay>
  </div>

  <!-- Shared contact-action menu (desktop popover / mobile sheet, self-adapting). -->
  <ContactActionMenu
    v-if="activeMenuContact"
    :contact="activeMenuContact"
    :anchor-rect="activeChipRect"
    @close="closeFriendMenu"
    @edit-contact="handleEditContact"
  />
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
  /* Clip the preview so a busy day never spills into the cell below. */
  overflow: hidden;
  cursor: pointer;
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

/* Truncate long names in the detail-list rows. */
.pill-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Per-day detail list (sheet/dialog body) ─────────────────────────────── */
.detail-body {
  display: flex;
  flex-direction: column;
}

.detail-heading {
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
  color: var(--color-on-surface);
  cursor: pointer;
}

.detail-row--static {
  cursor: default;
}

.detail-row:not(.detail-row--static):hover {
  background-color: var(--color-surface-variant);
}

/* Host for the detail sheet/dialog: fixed to the visual-viewport bottom on
   mobile; on desktop the child dialog self-centers (same pattern as map-page). */
.sheet-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

@media (min-width: 600px) {
  .sheet-container {
    display: contents;
  }
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

/* Mobile toggles on tap only (no drag), so keep native scroll — no
   `touch-action: none` here, unlike the desktop grid cells. */
.day-row--selectable {
  cursor: pointer;
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
