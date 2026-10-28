<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { CompletionFilter } from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SearchInput from '@/core/components/search-input.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import BackfillCollisionsPage from '@/features/tour-links/presentation/pages/backfill-collisions-page.vue'
import { outingKey, outingSegments } from '@/features/tours/domain/outing'
import { useActiveTourTab, useListedTourIds, useTourFilters } from '@/features/tours/presentation/composables/use-tour-filters'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import OutingListRow from './outing-list-row.vue'
import TourFiltersPanel from './tour-filters-panel.vue'
import TourListRow from './tour-list-row.vue'

const emit = defineEmits<{ close: [], selectTour: [id: string], selectOuting: [outingKey: string], addTour: [] }>()

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
const source = computed(() => (activeTab.value === 'friends' ? friendTours.value : tours.value))
const sourceCount = computed(() => source.value.length)

type ListEntry = { kind: 'tour', tour: Tour } | { kind: 'outing', key: string, segments: Tour[] }

/**
 * Rows after search + filters: an outing's segments fold into one row, placed where its first
 * matching segment was, and listing all its segments (#338, design D18).
 */
const listEntries = computed<ListEntry[]>(() => {
  const seen = new Set<string>()
  const entries: ListEntry[] = []
  for (const tour of filteredTours.value) {
    const key = outingKey(tour)
    const segments = outingSegments(source.value, key)
    if (segments.length === 0) {
      entries.push({ kind: 'tour', tour })
    }
    else if (!seen.has(key!)) {
      seen.add(key!)
      entries.push({ kind: 'outing', key: key!, segments })
    }
  }
  return entries
})
// The map marks only friend tours the viewer is a partner on (map-integration), so a narrowed
// Friends list says how many of its tours the map shows — else "Lena's tours" reads as broken.
const listedTourIds = useListedTourIds()
const friendsOnMap = computed(() => {
  const listed = listedTourIds.value
  if (activeTab.value !== 'friends' || !listed)
    return null
  const marked = friendTours.value.filter(t => listed.has(t.id) && t.isPartner === true).length
  return marked < listed.size ? marked : null
})

function clearAll() {
  active.value.clearAll()
}
// Two resets, deliberately different: the empty state clears search too (nothing
// matched — the query is the likely culprit), the filters' footer button leaves it
// alone because the search box stays visible above the open filters, so a filled
// query is never hidden context.
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

// ── Filters view ─────────────────────────────────────────────────────────────
// Open, the filters take the rows' place in the sheet's normal flow: one scroller, sized by the
// filter groups alone, so tapping a chip that thins the list never resizes the panel or moves a
// chip. The footer keeps reset and "show N tours" in the thumb zone at every scroll position.
// Deliberately a local ref, not module-level like the tab and the filter values: returning
// from a tour detail view remounts this sheet and must show the rows the user came back for.
const FILTERS_PANEL_ID = 'tour-filters-panel'
const filtersExpanded = ref(false)
const filtersRegionEl = ref<HTMLElement | null>(null)
const filtersTriggerRef = ref<InstanceType<typeof BaseButton> | null>(null)

function toggleFilters() {
  filtersExpanded.value = !filtersExpanded.value
}

function closeFilters() {
  filtersExpanded.value = false
}

/** Escape folds the open filters first; the drawer closes on the next one. */
function onListEscape(e: KeyboardEvent) {
  if (!filtersExpanded.value)
    return
  e.preventDefault()
  closeFilters()
}

watch(filtersExpanded, async (expanded) => {
  await nextTick()
  // Returning focus is the half that gets skipped; without it a keyboard user is
  // dumped at the top of the document every time they dismiss.
  // No scroll on focus: the tabs and search above the filters stay in view.
  const el = expanded ? filtersRegionEl.value : filtersTriggerRef.value?.$el as HTMLElement | undefined
  el?.focus({ preventScroll: true })
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
    :resizable="!isDesktop && !filtersExpanded"
    :hold-height="!isDesktop && (!!searchQuery.trim() || activeFilterCount > 0 || filtersExpanded)"
    @close="emit('close')"
    @keydown.escape="onListEscape"
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

    <div v-else class="list-view" :class="{ 'list-view--drawer': isDesktop }">
      <div class="list-header">
        <div
          class="tabs"
          role="tablist"
          data-tour="tours"
          data-tab-indicator
          :style="{ '--tab-index': activeTab === 'friends' ? 1 : 0, '--tab-count': 2 }"
        >
          <button
            type="button"
            role="tab"
            class="tab"
            :aria-selected="activeTab === 'owned'"
            @click="activeTab = 'owned'"
          >
            {{ t('tours.list.tabOwned') }}
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            :aria-selected="activeTab === 'friends'"
            @click="activeTab = 'friends'"
          >
            {{ t('tours.list.tabFriends') }}
          </button>
        </div>

        <SearchInput v-model="searchQuery" :placeholder="t('tours.list.searchPlaceholder')">
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
        </SearchInput>
      </div>

      <!-- `min-height: 0` lets this shrink inside the flex column instead of pushing
           the scroller past the shell. -->
      <div class="list-region">
        <div
          v-if="filtersExpanded"
          :id="FILTERS_PANEL_ID"
          ref="filtersRegionEl"
          class="region-scroll"
          role="region"
          :aria-label="t('tours.filters.panelAriaLabel')"
          tabindex="-1"
        >
          <TourFiltersPanel
            :filters="filters"
            :tab="activeTab"
            :tours="source"
            @update:partner-ids="(v: Set<string>) => (filters.partnerIds = v)"
            @update:owner-ids="(v: Set<string>) => (filters.ownerIds = v)"
            @update:tour-types="(v: Set<TourType>) => (filters.tourTypes = v)"
            @update:grades="(v: Set<string>) => (filters.grades = v)"
            @update:seasons="(v: Set<Season>) => (filters.seasons = v)"
            @update:date-range-from="(v: Date | null) => (filters.dateRange.from = v)"
            @update:date-range-to="(v: Date | null) => (filters.dateRange.to = v)"
            @update:completion="(v: CompletionFilter) => (filters.completion = v)"
          />
        </div>
        <!-- v-show: the rows (and the drawer's scroll position) survive a look at the filters. -->
        <div v-show="!filtersExpanded" class="tours-scroll region-scroll" :style="{ '--swap-dir': activeTab === 'friends' ? 1 : -1 }">
          <Transition name="tab-swap" mode="out-in">
            <div :key="activeTab">
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

              <template v-else>
                <p v-if="friendsOnMap !== null" class="map-note" data-testid="friends-on-map">
                  <BaseIcon name="map" size="sm" />
                  {{ t('tours.list.friendsOnMap', { count: friendsOnMap }) }}
                </p>
                <ul class="tours-list">
                  <template v-for="entry in listEntries" :key="entry.kind === 'tour' ? entry.tour.id : entry.key">
                    <TourListRow v-if="entry.kind === 'tour'" :tour="entry.tour" @click="handleRowClick(entry.tour.id)" />
                    <OutingListRow v-else :segments="entry.segments" @click="emit('selectOuting', entry.key)" />
                  </template>
                </ul>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <template v-if="filtersExpanded && !showBackfill" #footer>
      <div class="filters-footer">
        <BaseButton
          variant="secondary"
          data-testid="clear-filters"
          :disabled="activeFilterCount === 0"
          @click="clearFilters"
        >
          {{ t('tours.filters.resetBtn') }}
        </BaseButton>
        <BaseButton variant="primary" class="show-results" data-testid="show-results" @click="closeFilters">
          {{ t('tours.filters.showResultsBtn', { count: listEntries.length }) }}
        </BaseButton>
      </div>
    </template>
  </component>
</template>

<style scoped>
/* Mobile: the sheet's `.content` is the one scroller. Its body keeps its natural
   height (that is how the sheet measures what to fit), so nothing in here ever gets
   a definite height to scroll within. Keep it that way: a nested `overflow: auto`
   that never overflows still catches the touch on Chromium (Android), and with
   `overscroll-behavior: contain` it refuses to hand the gesture on to the sheet —
   the list stops scrolling. iOS skips such boxes, which hides the bug there.
   Desktop is the opposite: the side drawer is 100vh, so `height: 100%` resolves,
   the list exactly fills the drawer's scroller and `.list-region` clips the rows —
   there the list must scroll itself (`.list-view--drawer`). */
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
  background-color: var(--color-background);
  padding-bottom: var(--spacing-xs);
}

/* Switching My Tours ↔ Friends slides the list toward the chosen tab. */
.tab-swap-enter-active,
.tab-swap-leave-active {
  transition:
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.tab-swap-leave-active {
  transition-duration: var(--motion-duration-short);
}

.tab-swap-enter-from {
  opacity: 0;
  transform: translateX(calc(var(--swap-dir) * var(--motion-offset)));
}

.tab-swap-leave-to {
  opacity: 0;
  transform: translateX(calc(var(--swap-dir) * -1 * var(--motion-offset)));
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
  overflow: hidden;
}

/* Desktop only (see `.list-view`): the rows or the filters scroll themselves.
   `overflow-x` explicit: unset, it computes to `auto` and the tab-swap slide would
   flash a horizontal scrollbar. */
.list-view--drawer .region-scroll {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.region-scroll:focus {
  outline: none;
}

/* Thumb zone: reset and apply sit side by side, apply wider — it is the way back. */
.filters-footer {
  display: flex;
  gap: var(--spacing-sm);
}

.show-results {
  flex: 1;
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

.map-note {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-block: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.tours-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
