<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { LegDirection } from '@/features/tours/domain/legs'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

/**
 * Which way each activity goes (change: activity-legs, design D3): one line per selected
 * activity — up (start → goal), both, down (goal → end). The form owns the choices, their
 * defaults and which are allowed (a way never loses its last activity); this only shows them.
 */
const props = defineProps<{
  types: readonly TourType[]
  direction: (type: TourType) => LegDirection
  allowed: (type: TourType, way: LegDirection) => boolean
  /** A lone glider: flown from the goal only, or the whole way from the start (thermals). */
  solo?: boolean
}>()
const emit = defineEmits<{ set: [type: TourType, direction: LegDirection] }>()

const { t } = useI18n({ useScope: 'global' })
const WAYS = [
  { value: 'up', icon: 'arrow_upward' },
  { value: 'both', icon: 'swap_vert' },
  { value: 'down', icon: 'arrow_downward' },
] as const
const activity = (type: TourType) => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`)
const ways = computed(() => (props.solo ? WAYS.filter(way => way.value !== 'up') : WAYS))
/** A greyed way says why, beneath the lines — a disabled button can't be tapped for it. */
const blocked = computed(() => props.types.some(type => WAYS.some(way => !props.allowed(type, way.value))))
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
          v-for="way in ways" :key="way.value" type="button" role="radio" class="way"
          :class="{ selected: direction(type) === way.value }" :aria-checked="direction(type) === way.value"
          :disabled="!allowed(type, way.value)" :title="allowed(type, way.value) ? undefined : t('tours.form.legs.needsOne')"
          :data-way="way.value" @click="emit('set', type, way.value)"
        >
          <BaseIcon :name="way.icon" size="sm" />
          {{ t(`tours.form.legs.${way.value}`) }}
        </button>
      </span>
    </div>
    <p class="hint">
      {{ t(solo ? 'tours.form.legs.soloHint' : 'tours.form.legs.hint') }}
      <template v-if="blocked">
        {{ t('tours.form.legs.needsOne') }}
      </template>
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

.way:disabled {
  color: var(--color-outline);
  cursor: default;
}

@media (hover: hover) {
  .way:hover:not(.selected, :disabled) {
    background: var(--color-surface-variant);
  }
}

.hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}
</style>
