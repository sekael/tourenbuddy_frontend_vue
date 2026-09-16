<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { CompletionFilter } from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import BackfillCollisionsPage from '@/features/tour-links/presentation/pages/backfill-collisions-page.vue'
import { useActiveTourTab, useTourFilters } from '@/features/tours/presentation/composables/use-tour-filters'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import TourFiltersPanel from './tour-filters-panel.vue'
import TourListRow from './tour-list-row.vue'

const emit = defineEmits<{ close: [], selectTour: [id: string], addTour: [] }>()

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const toursStore = useToursStore()
const { tours, friendTours, isLoading } = storeToRefs(toursStore)

const isDesktop = useIsDesktop()

// Owned and Friends are separate, no merged list. Each tab keeps its own
// persistent search + filters via the namespaced composable.
const activeTab = useActiveTourTab()
const owned = useTourFilters('owned')
const friends = useTourFilters('friends')
const active = computed(() => (activeTab.value === 'friends' ? friends : owned))

const searchQuery = computed({
  get: () => active.value.searchQuery.value,
  set: v => (active.value.searchQuery.value = v),
})
const filters = computed(() => active.value.filters)
const filteredTours = computed(() => active.value.filteredTours.value)
const activeFilterCount = computed(() => active.value.activeFilterCount.value)
const sourceCount = computed(() => (activeTab.value === 'friends' ? friendTours.value.length : tours.value.length))
function clearAll() {
  active.value.clearAll()
}
// Two resets, deliberately different: the empty state clears search too (nothing
// matched — the query is the likely culprit), the panel's button leaves it alone
// because the search box stays visible above the open panel, so a filled query is
// never hidden context.
function clearFilters() {
  active.value.clearFilters()
}

const friendshipsStore = useFriendshipsStore()
const { friendships } = storeToRefs(friendshipsStore)
const hasFriends = computed(() => friendships.value.length > 0)

// Embedded backfill view (Issue 2): opening the in-app backfill page swaps the
// sheet body in place rather than navigating to a separate route. Back returns
// to the list with prior tab/search/filter state intact.
const showBackfill = ref(false)
function openBackfill() {
  showBackfill.value = true
}
function closeBackfill() {
  showBackfill.value = false
}

// Refetch friend tours when the Friends tab is opened (realtime deferred — issue #198).
watch(activeTab, (tab) => {
  if (tab === 'friends')
    toursStore.loadFriendTours()
})

// ponytail: no owner-name prefetch here. Each row resolves its own owner through
// `useFriendDisplayName`, and the store's in-flight registry collapses concurrent rows to
// one lookup per DISTINCT owner — so a second writer would only reintroduce the two-writer
// shape that makes the settle gate flicker. Ceiling: a friends list with many distinct
// owners still fires one lookup each on first paint. If that ever measurably stalls, batch
// it here with `friendshipsStore.ensurePhones(ownerIds)`; don't revive a name prefetch.

// ── Filters overlay ──────────────────────────────────────────────────────────
// Deliberately a local ref, not module-level like the tab and the filter values:
// returning from a tour detail view remounts this sheet, and re-opening an opaque
// overlay over the list the user just navigated back to would hide the rows they
// came for. The selection survives regardless — it lives in the composable.
const FILTERS_PANEL_ID = 'tour-filters-panel'
const filtersExpanded = ref(false)
const filtersOverlayEl = ref<HTMLElement | null>(null)
const listHeaderEl = ref<HTMLElement | null>(null)
const filtersTriggerRef = ref<InstanceType<typeof BaseButton> | null>(null)

function toggleFilters() {
  filtersExpanded.value = !filtersExpanded.value
}

function closeFilters() {
  filtersExpanded.value = false
}

// The header (tabs, search, trigger) counts as part of the panel's surface, not as
// "outside": the overlay covers the whole list region, so the header is all that is
// left to tap, and a literal outside-rule would make the search box undismissable —
// tapping it to type would close the panel. Excluding the header also covers the
// trigger, whose own click must not close-then-reopen in one gesture.
function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target)
    return
  if (filtersOverlayEl.value?.contains(target) || listHeaderEl.value?.contains(target))
    return
  closeFilters()
}

watch(filtersExpanded, async (expanded) => {
  if (expanded) {
    document.addEventListener('pointerdown', onDocumentPointerDown)
    await nextTick()
    filtersOverlayEl.value?.focus()
    return
  }
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  // Returning focus is the half that gets skipped; without it a keyboard user is
  // dumped at the top of the document every time they dismiss.
  ;(filtersTriggerRef.value?.$el as HTMLElement | undefined)?.focus()
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

function handleRowClick(tourId: string) {
  emit('selectTour', tourId)
}
</script>

<template>
  <component
    :is="isDesktop ? SideDrawer : BottomSheet"
    :title="t('tours.list.title')"
    :fit-content="!isDesktop"
    @close="emit('close')"
  >
    <template #header-actions>
      <BaseTooltip
        v-if="activeTab === 'friends' && hasFriends && isDesktop"
        :text="t('tours.list.viewBackfillCollisionsBtn')"
      >
        <BaseIconButton
          name="sync_alt"
          :label="t('tours.list.viewBackfillCollisionsBtn')"
          data-testid="header-backfill"
          @click="openBackfill"
        />
      </BaseTooltip>
      <BaseIconButton
        v-else-if="activeTab === 'friends' && hasFriends"
        name="sync_alt"
        :label="t('tours.list.viewBackfillCollisionsBtn')"
        data-testid="header-backfill"
        @click="openBackfill"
      />
      <BaseIconButton
        name="calendar_today"
        :label="t('calendar.openAriaLabel')"
        data-testid="header-open-calendar"
        data-tour="open-calendar"
        @click="router.push({ name: 'calendar' })"
      />
      <BaseTooltip
        v-if="!isAuthenticated"
        :text="t('map.overlay.signInToAddToursTooltip')"
      >
        <BaseIconButton
          name="add_location_alt"
          :label="t('tours.list.addTourAriaLabel')"
          data-testid="header-add-tour"
          :disabled="!isAuthenticated"
          @click="emit('addTour')"
        />
      </BaseTooltip>
      <BaseIconButton
        v-else
        name="add_location_alt"
        :label="t('tours.list.addTourAriaLabel')"
        data-testid="header-add-tour"
        @click="emit('addTour')"
      />
    </template>

    <BackfillCollisionsPage
      v-if="showBackfill"
      mode="all"
      @back="closeBackfill"
    />

    <!-- Escape is bound here, not on the panel: focus may legitimately sit in the
         search input, which is the panel's SIBLING, so a listener on the panel root
         would never see that keydown. This is the nearest common ancestor. -->
    <div v-else class="list-view" @keydown.escape="closeFilters">
      <div ref="listHeaderEl" class="list-header">
        <div class="tabs" role="tablist" data-tour="tours">
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': activeTab === 'owned' }"
            :aria-selected="activeTab === 'owned'"
            @click="activeTab = 'owned'"
          >
            {{ t('tours.list.tabOwned') }}
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': activeTab === 'friends' }"
            :aria-selected="activeTab === 'friends'"
            @click="activeTab = 'friends'"
          >
            {{ t('tours.list.tabFriends') }}
          </button>
        </div>

        <div class="search-row">
          <BaseIcon name="search" class="search-icon" />
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            :placeholder="t('tours.list.searchPlaceholder')"
          >
          <BaseButton
            ref="filtersTriggerRef"
            variant="secondary"
            size="sm"
            class="filters-trigger"
            :aria-expanded="filtersExpanded"
            :aria-controls="FILTERS_PANEL_ID"
            @click="toggleFilters"
          >
            <BaseIcon :name="filtersExpanded ? 'expand_less' : 'tune'" size="sm" />
            {{ t('tours.list.filtersBtn') }}
            <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
          </BaseButton>
        </div>
      </div>

      <!-- `min-height: 0` lets this shrink inside the flex column instead of pushing
           the scroller past the shell; `overflow: hidden` clips the panel's slide-in;
           `position: relative` is what the overlay's `inset: 0` resolves against. -->
      <div class="list-region">
        <div class="tours-scroll">
          <div v-if="activeTab === 'owned' && isLoading && tours.length === 0" class="loading-text">
            {{ t('tours.list.loading') }}
          </div>

          <div v-else-if="sourceCount === 0" class="empty-state">
            <BaseIcon :name="activeTab === 'friends' ? 'group' : 'location_on'" size="xl" class="empty-icon" />
            <p class="empty-text">
              {{ activeTab === 'friends' ? t('tours.list.friendsEmptyTitle') : t('tours.list.emptyTitle') }}
            </p>
            <p class="empty-sub">
              {{ activeTab === 'friends' ? t('tours.list.friendsEmptySubtitle') : t('tours.list.emptySubtitle') }}
            </p>
          </div>

          <div v-else-if="filteredTours.length === 0" class="empty-state">
            <BaseIcon name="search_off" size="xl" class="empty-icon" />
            <p class="empty-text">
              {{ t('tours.list.noMatchesTitle') }}
            </p>
            <BaseButton variant="primary" size="sm" @click="clearAll">
              {{ t('tours.list.clearFiltersBtn') }}
            </BaseButton>
          </div>

          <ul v-else class="tours-list">
            <TourListRow
              v-for="tour in filteredTours"
              :key="tour.id"
              :tour="tour"
              @click="handleRowClick(tour.id)"
            />
          </ul>
        </div>

        <Transition name="filters-slide">
          <div
            v-if="filtersExpanded"
            :id="FILTERS_PANEL_ID"
            ref="filtersOverlayEl"
            class="filters-overlay"
            role="region"
            :aria-label="t('tours.filters.panelAriaLabel')"
            tabindex="-1"
          >
            <TourFiltersPanel
              :filters="filters"
              :match-count="filteredTours.length"
              :can-clear="activeFilterCount > 0"
              @clear="clearFilters"
              @update:partner-ids="(v: Set<string>) => (filters.partnerIds = v)"
              @update:tour-types="(v: Set<TourType>) => (filters.tourTypes = v)"
              @update:seasons="(v: Set<Season>) => (filters.seasons = v)"
              @update:date-range-from="(v: Date | null) => (filters.dateRange.from = v)"
              @update:date-range-to="(v: Date | null) => (filters.dateRange.to = v)"
              @update:completion="(v: CompletionFilter) => (filters.completion = v)"
            />
          </div>
        </Transition>
      </div>
    </div>
  </component>
</template>

<style scoped>
/* The list owns its scrolling, not the shell. That is the precondition for an
   overlay that does not scroll with the rows — `position: absolute` inside a
   scrolling ancestor scrolls with the content — and it is why the header needs no
   `position: sticky`: it stays put because it sits OUTSIDE the scroller.
   `height: 100%` survives the sheet's natural-height measurement, which sets the
   sheet itself to `height: auto`, leaving this percentage to resolve to `auto`. */
.list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  z-index: 1;
  border-bottom: 1px solid var(--color-outline-variant);
  background-color: var(--color-background);
  padding-bottom: var(--spacing-xs);
}

.tabs {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1.5px solid var(--color-outline-variant);
}

.tab {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* Search and the filters trigger share one row. No `flex-wrap`: wrapping onto a
   second line would hand back the vertical space this merge exists to reclaim, so
   the input shrinks instead. */
.search-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
}

.search-icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
}

/* Visual styling comes from BaseButton (secondary); only layout lives here. */
.filters-trigger {
  flex-shrink: 0;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.list-region {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.tours-scroll {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Opaque, not a translucent scrim: tour names bleeding through the filter chips is
   the same legibility failure this component already fixed in its header. */
.filters-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  background-color: var(--color-background);
  overflow-y: auto;
  /* Without this, flicking past the end of a short filter list chains outward to
     the sheet drag and the map behind it. */
  overscroll-behavior: contain;
  outline: none;
}

/* Slides out from under the search row, so the panel keeps the spatial explanation
   the inline expand used to provide for free. Clipped by `.list-region`. */
.filters-slide-enter-active,
.filters-slide-leave-active {
  transition: transform 0.2s ease-out;
}

.filters-slide-enter-from,
.filters-slide-leave-to {
  transform: translateY(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .filters-slide-enter-active,
  .filters-slide-leave-active {
    transition: none;
  }
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-align: center;
  padding: var(--spacing-xl) 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) 0;
  text-align: center;
}

.empty-icon {
  color: var(--color-outline-variant);
}

.empty-text {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.empty-sub {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  opacity: 0.7;
}

.tours-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
