<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type {
  CompletionFilter,
  TourFilters,
} from '@/features/tours/presentation/composables/use-tour-filters'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { SEASON_VALUES } from '@/features/tours/data/models/season'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'

const props = defineProps<{ filters: TourFilters }>()
const emit = defineEmits<{
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
  if (next.has(id)) next.delete(id)
  else next.add(id)
  emit('update:partnerIds', next)
}

function toggleTourType(type: TourType) {
  const next = new Set(props.filters.tourTypes)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  emit('update:tourTypes', next)
}

function toggleSeason(season: Season) {
  const next = new Set(props.filters.seasons)
  if (next.has(season)) next.delete(season)
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
          />
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
          />
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
</template>

<style scoped>
.filters-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-top: var(--spacing-sm);
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
  padding: 4px var(--spacing-sm);
  border-radius: 9999px;
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
  padding: 4px var(--spacing-sm);
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
  padding: 4px var(--spacing-md);
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
