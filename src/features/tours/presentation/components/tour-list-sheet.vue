<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { CompletionFilter } from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useTourFilters } from '@/features/tours/presentation/composables/use-tour-filters'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import TourFiltersPanel from './tour-filters-panel.vue'
import TourListRow from './tour-list-row.vue'

const emit = defineEmits<{ close: [] }>()

const toursStore = useToursStore()
const mapStore = useMapStore()
const { tours, isLoading } = storeToRefs(toursStore)

const isDesktop = useIsDesktop()
const { searchQuery, filters, filteredTours, activeFilterCount, clearAll } = useTourFilters()
const filtersExpanded = ref(false)

function handleRowClick(tourId: string) {
  mapStore.selectTour(tourId)
  emit('close')
}
</script>

<template>
  <component :is="isDesktop ? SideDrawer : BottomSheet" title="Tours" @close="emit('close')">
    <div class="list-view">
      <div class="search-row">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Search tours…"
        >
      </div>

      <button class="filters-trigger" type="button" @click="filtersExpanded = !filtersExpanded">
        <span class="material-symbols-outlined trigger-icon">
          {{ filtersExpanded ? 'expand_less' : 'tune' }}
        </span>
        Filters
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

      <div v-if="isLoading && tours.length === 0" class="loading-text">
        Loading…
      </div>

      <div v-else-if="tours.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">location_on</span>
        <p class="empty-text">
          No tours yet.
        </p>
        <p class="empty-sub">
          Create one from the map.
        </p>
      </div>

      <div v-else-if="filteredTours.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">search_off</span>
        <p class="empty-text">
          No tours match your filters.
        </p>
        <button class="clear-filters-btn" type="button" @click="clearAll">
          Clear filters
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
</style>
