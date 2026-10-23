<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { LegDirection } from '@/features/tours/domain/legs'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

/**
 * Which way each activity goes (change: activity-legs, design D3): one line per selected
 * activity — up (start → goal), both, down (goal → end). The form owns the choices and their
 * defaults; this only shows and reports them.
 */
defineProps<{ types: readonly TourType[], direction: (type: TourType) => LegDirection }>()
const emit = defineEmits<{ set: [type: TourType, direction: LegDirection] }>()

const { t } = useI18n({ useScope: 'global' })
const WAYS = [
  { value: 'up', icon: 'arrow_upward' },
  { value: 'both', icon: 'swap_vert' },
  { value: 'down', icon: 'arrow_downward' },
] as const
const activity = (type: TourType) => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`)
</script>

<template>
  <fieldset class="legs" data-testid="activity-legs">
    <legend class="label">
      {{ t('tours.form.legs.label') }}
    </legend>
    <div v-for="type in types" :key="type" class="leg" :data-leg="type">
      <span class="leg-type" :style="{ '--leg-color': TOUR_TYPE_COLORS[type] }">
        <BaseIcon :name="TOUR_TYPE_ICONS[type]" class="leg-icon" />
        <span class="leg-name">{{ activity(type) }}</span>
      </span>
      <span class="ways" role="radiogroup" :aria-label="activity(type)">
        <button
          v-for="way in WAYS" :key="way.value" type="button" role="radio" class="way"
          :class="{ selected: direction(type) === way.value }" :aria-checked="direction(type) === way.value"
          :data-way="way.value" @click="emit('set', type, way.value)"
        >
          <BaseIcon :name="way.icon" size="sm" />
          {{ t(`tours.form.legs.${way.value}`) }}
        </button>
      </span>
    </div>
    <p class="hint">
      {{ t('tours.form.legs.hint') }}
    </p>
  </fieldset>
</template>

<style scoped>
.legs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.label {
  padding: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--field-label-color);
}

.leg {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxs) var(--spacing-sm);
}

.leg-type {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
}

.leg-icon {
  flex: none;
  color: var(--leg-color);
}

.leg-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* One pill cut in three: the choice reads as one of three, not three toggles. */
.ways {
  display: inline-flex;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.way {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 36px;
  padding: 0 var(--spacing-sm);
  border: none;
  background: var(--color-background);
  color: var(--color-on-surface-variant);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.way + .way {
  border-inline-start: 1px solid var(--color-outline-variant);
}

.way.selected {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

@media (hover: hover) {
  .way:hover:not(.selected) {
    background: var(--color-surface-variant);
  }
}

.hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}
</style>
