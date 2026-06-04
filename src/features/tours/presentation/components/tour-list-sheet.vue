<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { CompletionFilter } from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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

// Resolve friend-tour owner profile names for the "owned by" row label.
watch(friendTours, (list) => {
  const ownerIds = [...new Set(list.map(tour => tour.userId))].filter(
    id => !friendshipsStore.userIdToNamesMap.has(id),
  )
  if (ownerIds.length > 0)
    friendshipsStore.getNamesByUserIds(ownerIds)
}, { immediate: true })

const filtersExpanded = ref(false)

function handleRowClick(tourId: string) {
  emit('selectTour', tourId)
}
</script>

<template>
  <component
    :is="isDesktop ? SideDrawer : BottomSheet"
    :title="t('tours.list.title')"
    @close="emit('close')"
  >
    <template #header-actions>
      <BaseTooltip
        v-if="!isAuthenticated"
        :text="t('map.overlay.signInToAddToursTooltip')"
      >
        <button
          class="header-add-btn"
          :disabled="!isAuthenticated"
          :aria-label="t('tours.list.addTourAriaLabel')"
          @click="emit('addTour')"
        >
          <span class="material-symbols-outlined" aria-hidden="true">add_location_alt</span>
        </button>
      </BaseTooltip>
      <button
        v-else
        class="header-add-btn"
        :aria-label="t('tours.list.addTourAriaLabel')"
        @click="emit('addTour')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">add_location_alt</span>
      </button>
    </template>

    <BackfillCollisionsPage
      v-if="showBackfill"
      mode="all"
      @back="closeBackfill"
    />

    <div v-else class="list-view">
      <div class="tabs" role="tablist">
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

      <button
        v-if="activeTab === 'friends' && hasFriends"
        type="button"
        class="backfill-entry-btn"
        @click="openBackfill"
      >
        <span class="material-symbols-outlined">sync_alt</span>
        {{ t('tours.list.viewBackfillCollisionsBtn') }}
      </button>

      <div class="search-row">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          :placeholder="t('tours.list.searchPlaceholder')"
        >
      </div>

      <button class="filters-trigger" type="button" @click="filtersExpanded = !filtersExpanded">
        <span class="material-symbols-outlined trigger-icon">
          {{ filtersExpanded ? 'expand_less' : 'tune' }}
        </span>
        {{ t('tours.list.filtersBtn') }}
        <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
      </button>

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
        <span class="material-symbols-outlined empty-icon">
          {{ activeTab === 'friends' ? 'group' : 'location_on' }}
        </span>
        <p class="empty-text">
          {{ activeTab === 'friends' ? t('tours.list.friendsEmptyTitle') : t('tours.list.emptyTitle') }}
        </p>
        <p class="empty-sub">
          {{ activeTab === 'friends' ? t('tours.list.friendsEmptySubtitle') : t('tours.list.emptySubtitle') }}
        </p>
      </div>

      <div v-else-if="filteredTours.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">search_off</span>
        <p class="empty-text">
          {{ t('tours.list.noMatchesTitle') }}
        </p>
        <button class="clear-filters-btn" type="button" @click="clearAll">
          {{ t('tours.list.clearFiltersBtn') }}
        </button>
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
  font-size: 20px;
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

.filters-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  align-self: flex-start;
  transition: background-color 0.15s;
}

.filters-trigger:hover {
  background-color: var(--color-surface-variant);
}

.trigger-icon {
  font-size: 18px;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9999px;
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
  font-size: 48px;
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

.clear-filters-btn {
  padding: var(--spacing-xs) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.clear-filters-btn:hover {
  background-color: var(--color-primary-dark);
}

.tours-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-on-surface);
  border: 1.5px solid var(--color-on-surface);
  background-color: var(--color-surface-variant);
  transition: background-color 0.15s;
}

.header-add-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-surface-variant) 70%, var(--color-on-surface));
}

.header-add-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.backfill-entry-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  align-self: flex-start;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s;
}

.backfill-entry-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
}
</style>
