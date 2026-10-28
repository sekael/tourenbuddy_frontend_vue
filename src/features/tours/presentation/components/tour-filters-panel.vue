<script setup lang="ts">
import type { GradeRange } from '@/features/tours/data/models/grade'
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
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { FILTER_GRADE_SCALES, GRADE_SCALES, gradeLeads, gradeScaleOf, tapGradeRange } from '@/features/tours/data/models/grade'
import { SEASON_VALUES } from '@/features/tours/data/models/season'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS, TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'
import { useFriendPeopleOptions } from '@/features/tours/presentation/composables/use-friend-people-options'

const props = defineProps<{
  filters: TourFilters
  /** The tab the filters belong to: Friends adds recorded-by and names partners by user. */
  tab: TourTab
  /** The tab's tours, unfiltered: which grade scales are worth offering. */
  tours: Tour[]
  /**
   * Rows the list will show on collapse — search AND filters, an outing counted once as its
   *  one row — so the number is a literal promise rather than a count that disagrees with it.
   */
  matchCount: number
  canClear: boolean
}>()
const emit = defineEmits<{
  'clear': []
  'update:partnerIds': [Set<string>]
  'update:ownerIds': [Set<string>]
  'update:tourTypes': [Set<TourType>]
  'update:gradeRanges': [GradeRange[]]
  'update:seasons': [Set<Season>]
  'update:dateRangeFrom': [Date | null]
  'update:dateRangeTo': [Date | null]
  'update:completion': [CompletionFilter]
}>()

const { t } = useI18n({ useScope: 'global' })

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

const people = useFriendPeopleOptions(() => props.filters)
// My Tours: the viewer's address book. Friends: the registered partners named on friend tours —
// their contact ids are never exposed — behind the names' settle gate.
const partnerOptions = computed(() => props.tab === 'friends'
  ? (people.settled.value ? people.partners.value : [])
  : contacts.value.map(c => ({ id: c.id, label: resolveContactName(c) })))
const ownerOptions = computed(() =>
  props.tab === 'friends' && people.settled.value ? people.owners.value : [])

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value))
    next.delete(value)
  else next.add(value)
  return next
}

// ── Grade (#351) ─────────────────────────────────────────────────────────────
const scalesInUse = computed(() =>
  new Set(props.tours.flatMap(tour => (tour.grade ? gradeLeads(tour.grade) : [])).map(gradeScaleOf)))
/** Scales a tour uses, plus any holding a range so it stays clearable. */
const gradeScales = computed(() => FILTER_GRADE_SCALES
  .filter(s => scalesInUse.value.has(s.grades) || props.filters.gradeRanges.some(r => gradeScaleOf(r.from) === s.grades))
  .map(s => ({
    ...s,
    // Every activity graded on it ("Ski tour, Splitboarding, …"), so the row needs no legend.
    activities: TOUR_TYPE_VALUES.filter(type => GRADE_SCALES[type] === s.grades)
      .map(type => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`))
      .join(', '),
  })))

function isGradeLit(grades: readonly string[], grade: string) {
  const range = props.filters.gradeRanges.find(r => gradeScaleOf(r.from) === grades)
  const i = grades.indexOf(grade)
  return !!range && i >= grades.indexOf(range.from) && i <= grades.indexOf(range.to)
}

const completionOptions = [
  { value: 'all' as const, key: 'completionAll' },
  { value: 'open' as const, key: 'completionOpen' },
  { value: 'done' as const, key: 'completionDone' },
]
</script>

<template>
  <div class="filters-panel">
    <!-- Always rendered — it carries the match count, which is the only feedback
         left once the panel covers the rows. Clear is conditional within it. -->
    <div class="filters-summary">
      <span class="match-count">{{ t('tours.filters.matchCount', { count: props.matchCount }) }}</span>
      <BaseButton
        v-if="props.canClear"
        variant="secondary"
        size="sm"
        data-testid="clear-filters"
        @click="emit('clear')"
      >
        <BaseIcon name="close" size="sm" />
        {{ t('tours.list.clearFiltersBtn') }}
      </BaseButton>
    </div>

    <div class="filters-body">
      <div v-if="ownerOptions.length" class="filter-group" data-testid="owner-filter">
        <p class="filter-label">
          {{ t('tours.filters.ownerLabel') }}
        </p>
        <div class="chip-row">
          <button
            v-for="owner in ownerOptions"
            :key="owner.id"
            class="chip"
            :class="{ active: filters.ownerIds.has(owner.id) }"
            :aria-pressed="filters.ownerIds.has(owner.id)"
            type="button"
            @click="emit('update:ownerIds', toggled(filters.ownerIds, owner.id))"
          >
            {{ owner.label }}
          </button>
        </div>
      </div>

      <div v-if="partnerOptions.length" class="filter-group" data-testid="partner-filter">
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
        <p class="filter-hint">
          {{ t('tours.filters.gradeHint') }}
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
            :class="{ active: isGradeLit(scale.grades, grade) }"
            :aria-pressed="isGradeLit(scale.grades, grade)"
            type="button"
            @click="emit('update:gradeRanges', tapGradeRange(filters.gradeRanges, grade))"
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
  </div>
</template>

<style scoped>
/* No padding on this root. The overlay that hosts it is the scroll container, and
   a sticky child's constraint rectangle is the scrollport inset by its padding —
   top padding here would pin `.filters-summary` below the panel's top edge and
   leave a channel the chips scroll through. Padding lives on `.filters-body`. */
.filters-panel {
  display: flex;
  flex-direction: column;
}

.filters-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-outline-variant);
  padding-block: var(--spacing-xs);
}

.match-count {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.filters-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-top: var(--spacing-md);
  padding-bottom: var(--spacing-md);
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
}

.filter-hint {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}

.scale-icon {
  flex: none;
  align-self: center;
  width: 24px;
  color: var(--color-on-surface-variant);
}

/* Short labels ("T3", "ZS"): narrow, even chips, so a whole scale — seven alpine grades — fits
   one row on a phone. Doubled class: `.chip` below sets the `padding` shorthand and would win on
   source order. */
.chip-row--grades {
  gap: var(--spacing-xxs);
}

.chip.chip--grade {
  min-width: 40px;
  padding-inline: var(--spacing-xs);
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
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--input-radius);
  padding: var(--spacing-xxs) var(--spacing-sm);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background: var(--input-bg);
}
</style>
