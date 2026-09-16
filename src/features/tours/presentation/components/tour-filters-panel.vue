<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type {
  CompletionFilter,
  TourFilters,
} from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { SEASON_VALUES } from '@/features/tours/data/models/season'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'

const props = defineProps<{
  filters: TourFilters
  /**
   * Tours the list will show on collapse — search AND filters, so the number is
   *  a literal promise rather than a filters-only count that disagrees with it.
   */
  matchCount: number
  canClear: boolean
}>()
const emit = defineEmits<{
  'clear': []
  'update:partnerIds': [Set<string>]
  'update:tourTypes': [Set<TourType>]
  'update:seasons': [Set<Season>]
  'update:dateRangeFrom': [Date | null]
  'update:dateRangeTo': [Date | null]
  'update:completion': [CompletionFilter]
}>()

const { t } = useI18n({ useScope: 'global' })

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

function togglePartner(id: string) {
  const next = new Set(props.filters.partnerIds)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  emit('update:partnerIds', next)
}

function toggleTourType(type: TourType) {
  const next = new Set(props.filters.tourTypes)
  if (next.has(type))
    next.delete(type)
  else next.add(type)
  emit('update:tourTypes', next)
}

function toggleSeason(season: Season) {
  const next = new Set(props.filters.seasons)
  if (next.has(season))
    next.delete(season)
  else next.add(season)
  emit('update:seasons', next)
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
      <div v-if="contacts.length" class="filter-group">
        <p class="filter-label">
          {{ t('tours.filters.partnerLabel') }}
        </p>
        <div class="chip-row">
          <button
            v-for="contact in contacts"
            :key="contact.id"
            class="chip"
            :class="{ active: filters.partnerIds.has(contact.id) }"
            type="button"
            @click="togglePartner(contact.id)"
          >
            {{ resolveContactName(contact) }}
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
            @click="toggleTourType(type)"
          >
            {{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}` as any) }}
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
            @click="toggleSeason(season)"
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
        <div class="segmented">
          <button
            v-for="opt in completionOptions"
            :key="opt.value"
            class="segment"
            :class="{ active: filters.completion === opt.value }"
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
  color: var(--color-on-surface-variant);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.chip {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--color-outline-variant);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  transition:
    background-color 0.15s,
    color 0.15s,
    border-color 0.15s;
  cursor: pointer;
}

.chip.active {
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.chip:hover:not(.active) {
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
  border-radius: var(--radius-sm);
  padding: var(--spacing-xxs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  background: transparent;
}

.segmented {
  display: flex;
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  overflow: hidden;
  align-self: flex-start;
}

.segment {
  padding: var(--spacing-xxs) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  transition: background-color 0.15s;
  cursor: pointer;
}

.segment:not(:last-child) {
  border-right: 1.5px solid var(--color-outline-variant);
}

.segment.active {
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.segment:hover:not(.active) {
  background-color: var(--color-surface-variant);
}
</style>
