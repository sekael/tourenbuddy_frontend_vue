<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { CompletionFilter } from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
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
// matched — the query is the likely culprit), the toolbar button leaves it alone
// because it sits next to a visibly filled search box and the badge it mirrors
// never counted search either.
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

const filtersExpanded = ref(false)

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

    <div v-else class="list-view">
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

      <BaseButton
        v-if="activeTab === 'friends' && hasFriends"
        variant="primary-outline"
        size="sm"
        class="backfill-entry-btn"
        @click="openBackfill"
      >
        <BaseIcon name="sync_alt" />
        {{ t('tours.list.viewBackfillCollisionsBtn') }}
      </BaseButton>

      <div class="search-row">
        <BaseIcon name="search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          :placeholder="t('tours.list.searchPlaceholder')"
        >
      </div>

      <div class="filters-row">
        <BaseButton variant="secondary" size="sm" class="filters-trigger" @click="filtersExpanded = !filtersExpanded">
          <BaseIcon :name="filtersExpanded ? 'expand_less' : 'tune'" size="sm" />
          {{ t('tours.list.filtersBtn') }}
          <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
        </BaseButton>

        <BaseButton
          v-if="activeFilterCount > 0"
          variant="secondary"
          size="sm"
          data-testid="clear-filters"
          @click="clearFilters"
        >
          <BaseIcon name="close" size="sm" />
          {{ t('tours.list.clearFiltersBtn') }}
        </BaseButton>
      </div>

      <TourFiltersPanel
        v-if="filtersExpanded"
        :filters="filters"
        @update:partner-ids="(v: Set<string>) => (filters.partnerIds = v)"
        @update:tour-types="(v: Set<TourType>) => (filters.tourTypes = v)"
        @update:seasons="(v: Set<Season>) => (filters.seasons = v)"
        @update:date-range-from="(v: Date | null) => (filters.dateRange.from = v)"
        @update:date-range-to="(v: Date | null) => (filters.dateRange.to = v)"
        @update:completion="(v: CompletionFilter) => (filters.completion = v)"
      />

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
  </component>
</template>

<style scoped>
.list-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
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
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
}

/* Visual styling comes from BaseButton (secondary); only layout lives here. */
.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);

  /* Pinned to the top of the overlay's scroll region (`.content` in bottom-sheet,
     `.drawer-content` in side-drawer) — same pattern as `.detail-header` in
     contact-detail-view. `sticky`, not `fixed`, so on mobile the row travels with
     the sheet when it is dragged between snap points. The expanded panel is tall
     enough to push its own collapse/reset controls off screen; keeping the row
     pinned means both stay one tap away at any scroll depth. Opaque background +
     z-index so the filter chips scrolling underneath do not show through. */
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: var(--color-background);
  padding-block: var(--spacing-xs);
}

.filters-trigger {
  align-self: flex-start;
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

/* Visual styling comes from BaseButton (primary-outline); only layout lives here. */
.backfill-entry-btn {
  align-self: flex-start;
}
</style>
