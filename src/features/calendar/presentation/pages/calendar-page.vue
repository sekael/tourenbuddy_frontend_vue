<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import ExtendedFab from '@/core/components/extended-fab.vue'
import { useAvailabilityStore } from '@/features/calendar/presentation/stores/availability-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import CalendarNav from '../components/calendar-nav.vue'
import PlannedCalendar from '../components/planned-calendar.vue'
import SeasonsGantt from '../components/seasons-gantt.vue'

type CalendarView = 'planned' | 'seasons'

const { t, locale } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const mapStore = useMapStore()
const toursStore = useToursStore()
const availabilityStore = useAvailabilityStore()
const { editing, saving } = storeToRefs(availabilityStore)

// View is a query param (deep-linkable, restored by the detail back button).
// Defaults to Planned; never persisted across visits.
const activeView = computed<CalendarView>(() => (route.query.view === 'seasons' ? 'seasons' : 'planned'))

function setView(view: CalendarView) {
  // Leaving the Planned view discards an in-progress availability edit (Cancel
  // semantics, no prompt).
  if (availabilityStore.editing)
    availabilityStore.cancel()
  router.replace({ name: 'calendar', query: { view } })
}

async function saveAvailability() {
  await availabilityStore.save()
}

// Planned-view month cursor (first of the visible month). Month is the default,
// unbounded paging, not persisted.
const currentMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
function shiftMonth(delta: number) {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + delta, 1)
}
// Ref to the Planned view so "Today" can also scroll the mobile list to the
// current day after the month has switched (and the list re-rendered).
const plannedCalendar = ref<{ scrollTodayIntoView: () => void } | null>(null)
function goToday() {
  currentMonth.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  nextTick(() => plannedCalendar.value?.scrollTodayIntoView?.())
}
const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(currentMonth.value),
)

// Back → the tour-list overlay on the map. Selecting a tour → its detail on the
// map, carrying the originating view so the detail back button can return here.
function goBack() {
  if (availabilityStore.editing)
    availabilityStore.cancel()
  mapStore.setPendingIntent({ openTours: true })
  router.push({ name: 'map' })
}
function selectTour(tourId: string) {
  mapStore.setPendingIntent({
    selectTourId: tourId,
    origin: activeView.value === 'seasons' ? 'cal-seasons' : 'cal-planned',
  })
  router.push({ name: 'map' })
}

onMounted(() => {
  // The map page normally populated the stores already; this is the cold path
  // (e.g. deep link straight to /calendar).
  if (toursStore.tours.length === 0)
    toursStore.loadTours()
  // Own availability drives the view-mode overlay, so load it up front (not only
  // when the editor opens).
  availabilityStore.load()
})
</script>

<template>
  <div class="calendar-page">
    <CalendarNav :active="activeView" @select="setView" />

    <main class="calendar-main">
      <header class="top-bar">
        <div class="bar-left">
          <BaseIconButton name="arrow_back" :label="t('calendar.back')" @click="goBack" />
        </div>

        <div class="bar-center">
          <template v-if="activeView === 'planned'">
            <BaseIconButton name="chevron_left" size="sm" :label="t('calendar.planned.prevMonth')" @click="shiftMonth(-1)" />
            <h2 class="top-title">
              {{ monthLabel }}
            </h2>
            <BaseIconButton name="chevron_right" size="sm" :label="t('calendar.planned.nextMonth')" @click="shiftMonth(1)" />
          </template>
          <h2 v-else class="top-title">
            {{ t('calendar.seasons.title') }}
          </h2>
        </div>

        <div class="bar-right">
          <BaseButton v-if="activeView === 'planned' && !editing" variant="secondary" size="sm" @click="goToday">
            {{ t('calendar.planned.today') }}
          </BaseButton>
        </div>
      </header>

      <div class="calendar-canvas">
        <PlannedCalendar v-if="activeView === 'planned'" ref="plannedCalendar" :view-date="currentMonth" @select="selectTour" />
        <SeasonsGantt v-else @select="selectTour" />
      </div>

      <!-- Availability edit entry (Planned, view mode). Hidden while editing. -->
      <ExtendedFab
        v-if="activeView === 'planned' && !editing"
        class="availability-fab"
        :label="t('calendar.availability.edit')"
        @click="availabilityStore.enterEdit"
      >
        <template #icon>
          <BaseIcon name="edit" />
        </template>
      </ExtendedFab>

      <!-- Edit mode: friend-visibility disclaimer + Save/Cancel bar. -->
      <div v-if="editing" class="availability-bar">
        <p class="availability-disclaimer">
          {{ t('calendar.availability.disclaimer') }}
        </p>
        <div class="availability-actions">
          <BaseButton variant="secondary" size="sm" @click="availabilityStore.cancel">
            {{ t('calendar.availability.cancel') }}
          </BaseButton>
          <BaseButton variant="primary" size="sm" :disabled="saving" @click="saveAvailability">
            {{ t('calendar.availability.save') }}
          </BaseButton>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.calendar-page {
  display: flex;
  flex-direction: column-reverse;
  width: 100%;
  height: 100lvh;
  overflow: hidden;
  background-color: var(--color-background);
}

.calendar-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  /* Anchor for the availability FAB. The main column sits ABOVE the mobile
     bottom-nav in the layout, so anchoring here clears the nav for free. */
  position: relative;
}

/* Floats over the calendar; bottom-right of the main column (above the nav). */
.availability-fab {
  position: absolute;
  right: var(--spacing-lg);
  bottom: var(--spacing-lg);
  z-index: 10;
}

/* Edit-mode bar: in normal flow as the last child of main, so it sits below the
   calendar and above the bottom nav without any positioning math. */
.availability-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface);
}

.availability-disclaimer {
  flex: 1;
  min-width: 12rem;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.availability-actions {
  display: flex;
  gap: var(--spacing-sm);
}

/* Three slots: back (left), nav group (center), Today (right). Equal 1fr sides
   keep the auto-width center group centered no matter what the sides hold. */
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--spacing-sm);
  padding: calc(var(--safe-top) + var(--spacing-sm)) var(--spacing-md) var(--spacing-sm);
  flex-shrink: 0;
}

.bar-left {
  justify-self: start;
}

/* < Month Year > — chevrons flank the centered label. */
.bar-center {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
}

.bar-right {
  justify-self: end;
}

.top-title {
  /* Reserve room for the longest month+year across locales so the flanking
     chevrons stay put as the label changes length. Centered text keeps the
     slack even on both sides; min-width (not width) lets an outlier grow
     instead of clipping. */
  min-width: 8.5em;
  text-align: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  white-space: nowrap;
}

.calendar-canvas {
  flex: 1;
  min-height: 0;
  padding: 0 var(--spacing-md) var(--spacing-md);
  overflow: hidden;
}

/* Desktop: sidebar sits to the left of the main column. */
@media (min-width: 600px) {
  .calendar-page {
    flex-direction: row;
  }

  .calendar-canvas {
    padding: 0 var(--spacing-xxl) var(--spacing-xxl);
  }

  .top-bar {
    padding: var(--spacing-md) var(--spacing-xxl);
  }

  .availability-fab {
    right: var(--spacing-xxl);
    bottom: var(--spacing-xxl);
  }
}

/* Mobile: the reserved title box + back + chevrons + Today is a lot for a narrow
   bar — tighten the gap and drop the title a step so it all fits ~375px. */
@media (max-width: 599px) {
  .top-bar {
    gap: var(--spacing-xs);
  }

  .top-title {
    font-size: var(--font-size-lg);
  }
}
</style>
