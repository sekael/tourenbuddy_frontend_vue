<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import type {
  CompletionFilter,
  TourFilters,
  TourTab,
} from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { FILTER_GRADE_SCALES, GRADE_SCALES, gradeLeads, gradeScaleOf } from '@/features/tours/data/models/grade'
import { SEASON_VALUES } from '@/features/tours/data/models/season'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS, TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'
import { useFriendOwnerOptions } from '@/features/tours/presentation/composables/use-friend-owner-options'

const props = defineProps<{
  filters: TourFilters
  /** My Tours filters by partner, Friends by who recorded the tour. */
  tab: TourTab
  /** The tab's tours, unfiltered: which grade scales are worth offering. */
  tours: Tour[]
}>()
const emit = defineEmits<{
  'update:partnerIds': [Set<string>]
  'update:ownerIds': [Set<string>]
  'update:tourTypes': [Set<TourType>]
  'update:grades': [Set<string>]
  'update:seasons': [Set<Season>]
  'update:dateRangeFrom': [Date | null]
  'update:dateRangeTo': [Date | null]
  'update:completion': [CompletionFilter]
}>()

const { t } = useI18n({ useScope: 'global' })

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)
const partnerOptions = computed(() => contacts.value.map(c => ({ id: c.id, label: resolveContactName(c) })))

const { owners, settled: ownersSettled } = useFriendOwnerOptions(() => props.filters)

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value))
    next.delete(value)
  else next.add(value)
  return next
}

// ── Grade (#351) ─────────────────────────────────────────────────────────────
// Depends on the tab's tours only, never on the selection's results: the panel keeps its layout
// while chips are tapped.
const scalesInUse = computed(() =>
  new Set(props.tours.flatMap(tour => (tour.grade ? gradeLeads(tour.grade) : [])).map(gradeScaleOf)))
/** Scales a tour uses, plus any holding a selected grade so it stays clearable. */
const gradeScales = computed(() => FILTER_GRADE_SCALES
  .filter(s => scalesInUse.value.has(s.grades) || s.grades.some(g => props.filters.grades.has(g)))
  .map(s => ({
    ...s,
    // Every activity graded on it ("Ski tour, Splitboarding, …"), so the row needs no legend.
    activities: TOUR_TYPE_VALUES.filter(type => GRADE_SCALES[type] === s.grades)
      .map(type => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`))
      .join(', '),
  })))

const completionOptions = [
  { value: 'all' as const, key: 'completionAll' },
  { value: 'open' as const, key: 'completionOpen' },
  { value: 'done' as const, key: 'completionDone' },
]
</script>

<template>
  <div class="filters-panel">
    <!-- Friends: who recorded the tour. Held at one chip row until the names settle, so the
         groups below never jump when the chips arrive. -->
    <div v-if="tab === 'friends' && owners.length" class="filter-group" data-testid="owner-filter">
      <p class="filter-label">
        {{ t('tours.filters.ownerLabel') }}
      </p>
      <div class="chip-row">
        <template v-if="ownersSettled">
          <button
            v-for="owner in owners"
            :key="owner.id"
            class="chip"
            :class="{ active: filters.ownerIds.has(owner.id) }"
            :aria-pressed="filters.ownerIds.has(owner.id)"
            type="button"
            @click="emit('update:ownerIds', toggled(filters.ownerIds, owner.id))"
          >
            {{ owner.label }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="tab === 'owned' && partnerOptions.length" class="filter-group" data-testid="partner-filter">
      <p class="filter-label">
        {{ t('tours.filters.partnerLabel') }}
      </p>
      <div class="chip-row">
        <button
          v-for="partner in partnerOptions"
          :key="partner.id"
          class="chip"
          :class="{ active: filters.partnerIds.has(partner.id) }"
          :aria-pressed="filters.partnerIds.has(partner.id)"
          type="button"
          @click="emit('update:partnerIds', toggled(filters.partnerIds, partner.id))"
        >
          {{ partner.label }}
        </button>
      </div>
    </div>

    <div class="filter-group">
      <p class="filter-label">
        {{ t('tours.filters.activityLabel') }}
      </p>
      <div class="chip-row">
        <button
          v-for="type in TOUR_TYPE_VALUES"
          :key="type"
          class="chip"
          :class="{ active: filters.tourTypes.has(type) }"
          :aria-pressed="filters.tourTypes.has(type)"
          type="button"
          @click="emit('update:tourTypes', toggled(filters.tourTypes, type))"
        >
          {{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}` as any) }}
        </button>
      </div>
    </div>

    <div v-if="gradeScales.length" class="filter-group" data-testid="grade-filter">
      <p class="filter-label">
        {{ t('tours.filters.gradeLabel') }}
      </p>
      <div
        v-for="scale in gradeScales"
        :key="scale.type"
        class="chip-row chip-row--grades"
        role="group"
        :aria-label="t('tours.filters.gradeScale', { activities: scale.activities })"
      >
        <BaseIcon :name="TOUR_TYPE_ICONS[scale.type]" class="scale-icon" />
        <button
          v-for="grade in scale.grades"
          :key="grade"
          class="chip chip--grade"
          :class="{ active: filters.grades.has(grade) }"
          :aria-pressed="filters.grades.has(grade)"
          type="button"
          @click="emit('update:grades', toggled(filters.grades, grade))"
        >
          {{ grade }}
        </button>
      </div>
    </div>

    <div class="filter-group">
      <p class="filter-label">
        {{ t('tours.filters.seasonLabel') }}
      </p>
      <div class="chip-row">
        <button
          v-for="season in SEASON_VALUES"
          :key="season"
          class="chip"
          :class="{ active: filters.seasons.has(season) }"
          :aria-pressed="filters.seasons.has(season)"
          type="button"
          @click="emit('update:seasons', toggled(filters.seasons, season))"
        >
          {{ t(`tours.season.${season}` as any) }}
        </button>
      </div>
    </div>

    <div class="filter-group">
      <p class="filter-label">
        {{ t('tours.filters.plannedDateLabel') }}
      </p>
      <div class="date-row">
        <label class="date-field">
          <span class="date-label-text">{{ t('tours.filters.dateFromLabel') }}</span>
          <input
            type="date"
            class="date-input"
            :value="filters.dateRange.from ? filters.dateRange.from.toISOString().slice(0, 10) : ''"
            @change="
              (e) =>
                emit(
                  'update:dateRangeFrom',
                  (e.target as HTMLInputElement).value
                    ? new Date((e.target as HTMLInputElement).value)
                    : null,
                )
            "
          >
        </label>
        <label class="date-field">
          <span class="date-label-text">{{ t('tours.filters.dateToLabel') }}</span>
          <input
            type="date"
            class="date-input"
            :value="filters.dateRange.to ? filters.dateRange.to.toISOString().slice(0, 10) : ''"
            @change="
              (e) =>
                emit(
                  'update:dateRangeTo',
                  (e.target as HTMLInputElement).value
                    ? new Date((e.target as HTMLInputElement).value)
                    : null,
                )
            "
          >
        </label>
      </div>
    </div>

    <div class="filter-group">
      <p class="filter-label">
        {{ t('tours.filters.statusLabel') }}
      </p>
      <div
        class="segmented"
        data-tab-indicator
        :style="{ '--tab-index': completionOptions.findIndex(opt => opt.value === filters.completion), '--tab-count': completionOptions.length }"
      >
        <button
          v-for="opt in completionOptions"
          :key="opt.value"
          class="segment"
          :aria-pressed="filters.completion === opt.value"
          type="button"
          @click="emit('update:completion', opt.value)"
        >
          {{ t(`tours.filters.${opt.key}` as any) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters-panel {
  /* Glove-sized targets: filters get tapped outdoors, often with cold or gloved hands. */
  --chip-min-height: 44px;

  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-block: var(--spacing-sm);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.filter-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--field-label-color);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  /* One chip row's height even while empty (owners not yet named). */
  min-height: var(--chip-min-height);
}

.scale-icon {
  flex: none;
  align-self: center;
  width: 24px;
  color: var(--color-on-surface-variant);
}

/* Short labels ("T3", "ZS"): one grid row per scale, columns shared by every scale, so the
   longest — seven alpine grades — fits one row in a phone sheet and the desktop drawer alike and
   the scales line up. Doubled class: `.chip` below sets the `padding` shorthand and would win on
   source order. */
.chip-row.chip-row--grades {
  display: grid;
  grid-template-columns: 24px repeat(7, minmax(0, 1fr));
  gap: var(--spacing-xxs);
}

.chip.chip--grade {
  min-width: 0;
  padding-inline: 0;
}

.chip {
  padding: var(--chip-padding);
  border-radius: var(--chip-radius);
  border: 1.5px solid var(--color-outline-variant);
  font-size: var(--chip-font-size);
  color: var(--chip-color);
  transition:
    background-color var(--motion-duration-short) var(--motion-ease-standard),
    color var(--motion-duration-short) var(--motion-ease-standard),
    border-color var(--motion-duration-short) var(--motion-ease-standard);
  cursor: pointer;
  min-height: var(--chip-min-height);
}

.chip.active {
  background-color: var(--chip-selected-bg);
  border-color: var(--chip-selected-border-color);
  color: var(--chip-selected-color);
}

@media (hover: hover) {
  .chip:hover:not(.active) {
    background-color: var(--color-surface-variant);
  }
}

.chip:active:not(.active) {
  background-color: var(--color-surface-variant);
}

.date-row {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.date-field {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.date-label-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.date-input {
  min-height: var(--chip-min-height);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--input-radius);
  padding: var(--spacing-xxs) var(--spacing-sm);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background: var(--input-bg);
}

/* Status: the same glove-sized target as the chips (track padding adds the rest). */
.segmented > .segment {
  min-height: 40px;
}
</style>
