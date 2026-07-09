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
// is centered on the current month's slot. The leading offset is the label
// column width (`--label-w`), so the same calc stays aligned in both the desktop
// and the narrower mobile layout — 100% resolves to the rows track in each.
const nowLineLeft = computed(() => {
  const axisMonthIndex = (new Date().getMonth() + 1) % 12
  const fraction = (axisMonthIndex + 0.5) / 12
  return `calc(var(--label-w) + (100% - var(--label-w)) * ${fraction})`
})
</script>

<template>
  <div class="gantt-wrap">
    <!-- Single scroll container (both axes on mobile). The track holds the whole
         chart at its natural width so narrow viewports scroll horizontally. -->
    <div class="gantt">
      <div class="gantt-track">
        <!-- Header: label column + 4 season columns with month ranges. Sticky so
             it pins to the top while the tour rows scroll under it. -->
        <div class="gantt-row gantt-header">
          <div class="header-label">
            {{ t('calendar.title') }}
          </div>
          <div v-for="season in SEASON_AXIS" :key="season" class="header-season">
            <span class="season-name">{{ t(`tours.season.${season}`) }}</span>
            <span class="season-range">{{ t(`calendar.seasons.range.${season}`) }}</span>
          </div>
        </div>

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

    <!-- Mobile-only affordance: the season columns overflow and scroll sideways. -->
    <p class="scroll-hint">
      <BaseIcon name="sync_alt" size="xs" />
      {{ t('calendar.seasons.scrollHint') }}
    </p>
  </div>
</template>

<style scoped>
.gantt-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--color-background);
}

/* The scroll container. `--label-w` drives both the grid's label column and the
   marker offset; `--season-min` is the per-season floor that forces horizontal
   overflow once the columns no longer fit (see the mobile override below). */
.gantt {
  flex: 1;
  min-height: 0;
  overflow: auto;
  --label-w: 240px;
  --season-min: 0px;
}

/* Sized to its widest row (max-content), so on narrow viewports the four season
   columns push past the container and the .gantt scrolls sideways. */
.gantt-track {
  min-width: max-content;
}

/* Content-height wrapper: the marker below the header spans only the rows and
   ends at the last one, rather than the full track height. */
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
  grid-template-columns: var(--label-w) repeat(4, minmax(var(--season-min), 1fr));
  align-items: center;
}

.gantt-header {
  position: sticky;
  top: 0;
  z-index: 5;
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
  height: 28px;
  margin: 0 var(--spacing-sm);
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
}

.no-seasons {
  grid-column: 2 / -1;
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  font-style: italic;
  color: var(--color-on-surface-variant);
  opacity: 0.6;
}

/* Hidden on desktop (everything fits); revealed on mobile by the override below. */
.scroll-hint {
  display: none;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xs);
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  border-top: 1px solid var(--color-outline-variant);
}

/* Mobile: narrow the label and give the season columns a floor so they overflow
   and the chart scrolls sideways; reveal the scroll hint. */
@media (max-width: 599px) {
  .gantt {
    --label-w: 140px;
    --season-min: 120px;
  }
  .scroll-hint {
    display: flex;
  }
}
</style>
