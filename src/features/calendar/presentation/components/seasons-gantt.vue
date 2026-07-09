<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { SEASON_AXIS, seasonRuns } from '@/features/calendar/domain/season-runs'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const emit = defineEmits<{ select: [tourId: string] }>()

const { t } = useI18n({ useScope: 'global' })

// Seasons view is owned tours only — friend tours never appear here.
const toursStore = useToursStore()
const { tours } = storeToRefs(toursStore)

// "You are here" marker: a vertical line at the current month's position across
// the 4-season axis, which lands inside the current season's column. The axis
// runs Dec→Nov (winter first), so month 11 (Dec) maps to axis index 0. The line
// is centered on the current month's slot; the leading 240px is the label column.
const nowLineLeft = computed(() => {
  const axisMonthIndex = (new Date().getMonth() + 1) % 12
  const fraction = (axisMonthIndex + 0.5) / 12
  return `calc(240px + (100% - 240px) * ${fraction})`
})
</script>

<template>
  <div class="gantt">
    <!-- Header: label column + 4 season columns with month ranges. -->
    <div class="gantt-row gantt-header">
      <div class="header-label">
        {{ t('calendar.title') }}
      </div>
      <div v-for="season in SEASON_AXIS" :key="season" class="header-season">
        <span class="season-name">{{ t(`tours.season.${season}`) }}</span>
        <span class="season-range">{{ t(`calendar.seasons.range.${season}`) }}</span>
      </div>
    </div>

    <!-- Body -->
    <div class="gantt-body">
      <!-- Rows wrapper shrinks to its content, so the current-season marker
           (below the header) ends exactly at the last tour row. -->
      <div class="gantt-rows">
        <div class="season-now-line" :style="{ left: nowLineLeft }" aria-hidden="true" />
        <button
          v-for="tour in tours"
          :key="tour.id"
          type="button"
          class="gantt-row gantt-tour-row"
          @click="emit('select', tour.id)"
        >
          <div class="row-label">
            <span class="tour-name">{{ tour.name ?? t('tours.infoSheet.unnamedTour') }}</span>
            <span v-if="tour.tourType" class="tour-type">
              <BaseIcon :name="TOUR_TYPE_ICONS[tour.tourType]" size="xs" />
              {{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[tour.tourType]}`) }}
            </span>
          </div>

          <!-- One bar per contiguous run; empty state when nothing is tagged. -->
          <template v-if="seasonRuns(tour.seasons).length > 0">
            <div
              v-for="(run, i) in seasonRuns(tour.seasons)"
              :key="i"
              class="season-bar"
              :style="{ gridColumn: `${run.start + 2} / span ${run.span}` }"
            />
          </template>
          <span v-else class="no-seasons">{{ t('calendar.seasons.empty') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gantt {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--color-background);
}

/* Content-height wrapper: the marker below the header spans only the rows and
   ends at the last one, rather than the full (flex-filled) body height. */
.gantt-rows {
  position: relative;
}

/* Thin dark line marking the current month/season across the tour rows. */
.season-now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: var(--color-on-surface);
  opacity: 0.55;
  pointer-events: none;
  z-index: 3;
}

.gantt-row {
  display: grid;
  grid-template-columns: 240px repeat(4, 1fr);
  align-items: center;
}

.gantt-header {
  border-bottom: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface);
}

.header-label {
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-variant);
  border-right: 1px solid var(--color-outline-variant);
}

.header-season {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-xs);
}

.season-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.season-range {
  font-size: 10px;
  color: var(--color-on-surface-variant);
  opacity: 0.7;
}

.gantt-body {
  flex: 1;
  overflow-y: auto;
}

.gantt-tour-row {
  width: 100%;
  min-height: 64px;
  text-align: left;
  border-bottom: 1px solid var(--color-outline-variant);
  cursor: pointer;
  transition: background-color 0.15s;
}

.gantt-tour-row:hover {
  background-color: var(--color-surface);
}

.row-label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding: var(--spacing-md);
  border-right: 1px solid var(--color-outline-variant);
}

.tour-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.tour-type {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.season-bar {
  height: 32px;
  margin: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.no-seasons {
  grid-column: 2 / -1;
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  font-style: italic;
  color: var(--color-on-surface-variant);
  opacity: 0.6;
}
</style>
