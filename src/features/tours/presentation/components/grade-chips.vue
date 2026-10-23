<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { GRADE_MAX_LENGTH, gradeLeads, gradeScales, toggleGrade } from '@/features/tours/data/models/grade'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

/**
 * The selected activities' grade scales as one-tap chips (design D3 of smarter-tour-creation),
 * one row per scale led by its activity's icon. A tap sets that scale's part and keeps the
 * others ("S2, T4"), a lit chip clears it; a modifier (+, −) is typed after it and the chip
 * stays lit.
 */
const props = defineProps<{ tourTypes: readonly TourType[], disabled?: boolean }>()
const model = defineModel<string>({ required: true })

const { t } = useI18n({ useScope: 'global' })
const scales = computed(() => gradeScales(props.tourTypes))
/** "zs-" still is ZS. */
const lit = computed(() => new Set(gradeLeads(model.value)))

function tap(grade: string) {
  const next = toggleGrade(model.value, grade)
  // ponytail: a hand-typed long grade can leave no room for another part — the tap does nothing.
  if (next.length <= GRADE_MAX_LENGTH)
    model.value = next
}
</script>

<template>
  <div
    v-for="scale in scales" :key="scale.type" class="scale" role="group"
    :aria-label="t('tours.form.gradeScale', { activity: t(`tours.type.${TOUR_TYPE_I18N_KEYS[scale.type]}`) })"
  >
    <BaseIcon :name="TOUR_TYPE_ICONS[scale.type]" class="scale-icon" />
    <button
      v-for="grade in scale.grades" :key="grade" type="button" class="chip" :class="{ selected: lit.has(grade) }"
      :aria-pressed="lit.has(grade)" :disabled="disabled" data-testid="grade-chip" @click="tap(grade)"
    >
      {{ grade }}
    </button>
  </div>
</template>

<style scoped>
.scale {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xxs);
}

.scale-icon {
  flex: none;
  width: 24px;
  color: var(--color-on-surface-variant);
}

.chip {
  min-width: 44px;
  min-height: 36px;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
  background: var(--color-background);
  color: var(--color-on-surface);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.chip.selected {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
  color: var(--color-primary);
}

@media (hover: hover) {
  .chip:hover:not(.selected, :disabled) {
    background: var(--color-surface-variant);
  }
}
</style>
