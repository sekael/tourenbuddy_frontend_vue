<script setup lang="ts">
import type { StageContext } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import type { TourSurface } from '@/features/onboarding/presentation/onboarding-steps'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import ExtendedFab from '@/core/components/extended-fab.vue'
import { useAvailabilityStore } from '@/features/calendar/presentation/stores/availability-store'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import OnboardingTourBanner from '@/features/onboarding/presentation/components/onboarding-tour-banner.vue'
import OnboardingWelcome from '@/features/onboarding/presentation/components/onboarding-welcome.vue'
import { useOnboardingTour } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'
import { makeDemoChips, makeDemoSeason } from '../calendar-tour-demo'
import { CALENDAR_TOUR_STEPS } from '../calendar-tour-steps'
import CalendarNav from '../components/calendar-nav.vue'
import PlannedCalendar from '../components/planned-calendar.vue'
import SeasonsGantt from '../components/seasons-gantt.vue'

type CalendarView = 'planned' | 'seasons'

const { t, locale } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const mapStore = useMapStore()
const toursStore = useToursStore()
const contactsStore = useContactsStore()
const availabilityStore = useAvailabilityStore()
const userProfileStore = useUserProfileStore()
const { editing, saving } = storeToRefs(availabilityStore)

// Friend chip → contact-action menu → Edit opens the contact over the calendar,
// mirroring map-page. `initial-contact-id` deep-links the sheet to that contact;
// closing returns to the calendar.
const editContactId = ref<string | null>(null)
function handleEditContact(contactId: string) {
  editContactId.value = contactId
}
function handleContactsClose() {
  editContactId.value = null
}

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
const plannedCalendar = ref<{
  scrollTodayIntoView: () => void
  openDetailForDay: (date: Date) => void
} | null>(null)
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
function selectTour(tourId: string, day?: string) {
  mapStore.setPendingIntent({
    selectTourId: tourId,
    origin: activeView.value === 'seasons' ? 'cal-seasons' : 'cal-planned',
    originDay: day,
  })
  router.push({ name: 'map' })
}

// ── Calendar spotlight tour ─────────────────────────────────────────────────
// A second instance of the onboarding tour composable, hosting the calendar
// steps (see Decision 1). This page owns the concrete `stage` — it translates
// each abstract surface into a view switch + waypoint spotlight.
async function stageCalendarSurface(surface: TourSurface, ctx: StageContext) {
  switch (surface) {
    case 'availability':
    case 'day-chips':
      // Both live on the planned view (the default); make sure we're there.
      if (activeView.value !== 'planned')
        setView('planned')
      break
    case 'seasons':
      // Spotlight the seasons nav control, then switch to the seasons view so the
      // demo season bar (below) can be highlighted.
      await ctx.spotlight('[data-tour="nav-seasons"]', 'calendar.tour.nav.seasons')
      setView('seasons')
      break
  }
  await nextTick()
}

const calendarTour = useOnboardingTour({
  steps: CALENDAR_TOUR_STEPS,
  stage: stageCalendarSurface,
  // Any exit path returns to the planned view (Decision 6), so the user never
  // lands on an emptied seasons chart and the demo season bar is off-screen.
  cleanup: () => {
    if (activeView.value !== 'planned')
      setView('planned')
  },
  // 3 steps, no mid-tour resume: dismissing simply flips the gate.
  saveTourStep: () => {},
  getResumeStep: () => 0,
  // Welcome "Start" / "Don't show again" flip the calendar gate off.
  dismissTourAtSignIn: () => userProfileStore.dismissCalendarTour(),
  // Drives the STANDALONE welcome (no hand-off intent): show it iff the gate is
  // fresh. The hand-off path is handled explicitly in the gate rule below.
  canAutoStart: () =>
    userProfileStore.profile != null
    && userProfileStore.profile.calendarTourShowOnFirstOpen === true,
})

const {
  isRunning: tourRunning,
  isStaging: tourStaging,
  currentIndex: tourIndex,
  currentTitle: tourTitle,
  showWelcome: tourWelcome,
} = calendarTour
const tourTotal = calendarTour.totalSteps

// Demo content (chips + season bar) is derived ONLY from `isRunning`: null when
// the tour is not active, so it can never render outside the tour (7.4).
const demoChips = computed(() => (tourRunning.value ? makeDemoChips(t) : null))
const demoSeason = computed(() => (tourRunning.value ? makeDemoSeason(t) : null))

// Same body-level scroll-lock as the map tour (the rule lives in
// onboarding-tour.css) — viewport-fixed spotlight + popovers must pin together.
const tourLockActive = computed(() => tourRunning.value || tourWelcome.value)
watch(tourLockActive, (locked) => {
  document.documentElement.classList.toggle('tour-scroll-locked', locked)
}, { immediate: true })

// driver.js' overlay lives on <body> outside Vue: tear it down before leaving /
// on unmount so it never orphans onto another route.
onBeforeRouteLeave(() => calendarTour.stop())
onUnmounted(() => {
  calendarTour.stop()
  document.documentElement.classList.remove('tour-scroll-locked')
})

// The calendar-tour gate rule (Decision 2). One rule keyed on the
// `calendar_tour_show_on_first_open` gate governs every automatic trigger:
//   hand-off + fresh gate → start directly (no welcome) + flip the gate
//   hand-off + spent gate → nothing
//   no intent + fresh gate → welcome (maybeStartTour self-guards on the gate)
//   no intent + spent gate → nothing
// The intent is consumed on EVERY mount — even the do-nothing branches — so it
// can never survive to re-fire on a later visit.
function applyCalendarTourGate() {
  const handoff = mapStore.consumePendingIntent()?.startCalendarTour === true
  if (handoff) {
    if (userProfileStore.profile?.calendarTourShowOnFirstOpen === true) {
      userProfileStore.dismissCalendarTour()
      calendarTour.startTour(0)
    }
    return
  }
  // Standalone open: maybeStartTour opens the welcome iff the gate is fresh
  // (canAutoStart is wired to the gate above).
  calendarTour.maybeStartTour()
}

onMounted(() => {
  // Decide the calendar tour first — it consumes the hand-off intent and must run
  // regardless of the focus-day early return below.
  applyCalendarTourGate()

  // The map page normally populated the stores already; this is the cold path
  // (e.g. deep link straight to /calendar).
  if (toursStore.tours.length === 0)
    toursStore.loadTours()
  // Own availability drives the view-mode overlay, so load it up front (not only
  // when the editor opens).
  availabilityStore.load()
  // Friends' availability + the contacts that resolve friend chips to names/actions.
  availabilityStore.loadFriends()
  if (contactsStore.contacts.length === 0)
    contactsStore.loadContacts()

  // Returning from a tour opened off the calendar: re-open that day's detail list.
  // The `day` query param is a one-shot handoff — consume it and drop it so it
  // doesn't re-fire on later interactions.
  const focusDay = typeof route.query.day === 'string' ? route.query.day : null
  if (activeView.value !== 'planned')
    return
  if (focusDay) {
    const [y, m, d] = focusDay.split('-').map(Number)
    currentMonth.value = new Date(y!, m! - 1, 1) // show the month that day lives in
    nextTick(() => {
      plannedCalendar.value?.openDetailForDay(new Date(y!, m! - 1, d!))
      router.replace({ name: 'calendar', query: { view: 'planned' } })
    })
  }
  else {
    // Open on today, same as the Today button (no-op on desktop's month grid).
    nextTick(() => plannedCalendar.value?.scrollTodayIntoView?.())
  }
})
</script>

<template>
  <div class="calendar-page">
    <!-- Teleported to <body> so they share driver.js' top-level stacking context
         (driver appends its overlay to body), same as the map tour. -->
    <Teleport to="body">
      <Transition name="tour-slide">
        <OnboardingTourBanner
          v-if="tourRunning" :title="tourTitle" :current="tourIndex + 1" :total="tourTotal"
          :can-back="tourIndex > 0" :busy="tourStaging" @back="calendarTour.back()" @next="calendarTour.next()"
          @finish="calendarTour.finish()"
        />
      </Transition>
    </Teleport>
    <Teleport to="body">
      <OnboardingWelcome
        v-if="tourWelcome"
        title-key="calendar.tour.welcome.title"
        body-key="calendar.tour.welcome.body"
        @start="calendarTour.startFromWelcome()"
        @skip="calendarTour.skipWelcome()"
        @dismiss="calendarTour.dismissWelcome()"
      />
    </Teleport>

    <CalendarNav :active="activeView" @select="setView" />

    <main class="calendar-main">
      <header class="top-bar">
        <!-- Row 1: navigation chrome (back) + tour replay. -->
        <div class="top-row">
          <BaseIconButton name="arrow_back" :label="t('calendar.back')" @click="goBack" />
          <!-- Always-visible replay: starts the calendar tour on demand, bypassing
               the gate (the calendar analogue of the profile "Show app tour"). -->
          <BaseIconButton name="help" size="md" :label="t('calendar.tour.replay')" @click="calendarTour.startTour(0)" />
        </div>

        <!-- Row 2: month navigation / view name + Today. -->
        <div class="month-row">
          <template v-if="activeView === 'planned'">
            <div class="month-nav">
              <BaseIconButton name="chevron_left" size="sm" :label="t('calendar.planned.prevMonth')" @click="shiftMonth(-1)" />
              <h2 class="top-title">
                {{ monthLabel }}
              </h2>
              <BaseIconButton name="chevron_right" size="sm" :label="t('calendar.planned.nextMonth')" @click="shiftMonth(1)" />
            </div>
            <BaseButton v-if="!editing" variant="secondary" size="sm" @click="goToday">
              {{ t('calendar.planned.today') }}
            </BaseButton>
          </template>
          <h2 v-else class="top-title">
            {{ t('calendar.seasons.title') }}
          </h2>
        </div>
      </header>

      <div class="calendar-canvas">
        <PlannedCalendar v-if="activeView === 'planned'" ref="plannedCalendar" :view-date="currentMonth" :demo-chips="demoChips" @select="selectTour" @edit-contact="handleEditContact" />
        <SeasonsGantt v-else :demo-tour="demoSeason" @select="selectTour" />
      </div>

      <!-- Availability edit entry (Planned, view mode). Hidden while editing. -->
      <ExtendedFab
        v-if="activeView === 'planned' && !editing"
        class="availability-fab"
        data-tour="availability-edit"
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

      <!-- Contact opened from a friend chip's action menu. Self-adapting: dialog on
           desktop, bottom sheet on mobile. Closing returns to the calendar. -->
      <div v-if="editContactId !== null" class="sheet-container">
        <ContactsListSheet :initial-contact-id="editContactId" @close="handleContactsClose" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.calendar-page {
  display: flex;
  flex-direction: column-reverse;
  /* Pin to the viewport so the PAGE itself never scrolls — the bottom nav clamps
     above the browser URL bar and only .calendar-canvas scrolls. `fixed` also
     decouples from `#app { min-height: 100lvh }`, whose lvh−dvh tail otherwise
     hangs below the page in-browser as a dead zone the document scrolls into.
     The bottom nav owns its safe-area-inset-bottom, so PWA is unchanged. */
  position: fixed;
  inset: 0;
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

/* Floats over the calendar; bottom-right of the main column (above the nav).
   Offset = canvas padding (--spacing-md here) + the desired even gap to the
   calendar border, so the gap reads equal on the right and bottom edges. */
.availability-fab {
  position: absolute;
  right: var(--spacing-xl);
  bottom: var(--spacing-xl);
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

/* Two stacked rows: back + replay on top, month nav / view name + Today below —
   the top bar is too crowded for a single row once the replay button is added. */
.top-bar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: calc(var(--safe-top) + var(--spacing-sm)) var(--spacing-md) var(--spacing-sm);
  flex-shrink: 0;
}

/* Row 1: back pinned left, replay pinned right. */
.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Row 2: the month-nav group grows to center itself; Today sits at the right.
   In seasons view the lone title centers via the same flex fill. */
.month-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* < Month Year > — chevrons flank the centered label; fills the row so the label
   stays centered regardless of the Today button beside it. */
.month-nav {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxs);
}

.month-row > .top-title {
  flex: 1;
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

/* Host for the contact sheet/dialog (same pattern as map-page): fixed to the
   visual-viewport bottom on mobile; on desktop the child dialog self-centers. */
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

  /* Desktop canvas padding is --spacing-xxl, so add one more step for the same
     even gap to the border. */
  .availability-fab {
    right: var(--spacing-3xl);
    bottom: var(--spacing-3xl);
  }
}

/* Mobile: drop the title a step so the month row fits ~375px. */
@media (max-width: 599px) {
  .top-title {
    font-size: var(--font-size-lg);
  }
}
</style>
