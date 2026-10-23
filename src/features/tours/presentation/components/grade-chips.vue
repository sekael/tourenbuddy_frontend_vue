<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { gradeScales } from '@/features/tours/data/models/grade'

/**
 * The selected activities' grade scales as one-tap chips (design D3 of smarter-tour-creation).
 * A tap sets the grade; a modifier (+, −) is typed after it, and the chip stays lit.
 */
const props = defineProps<{ tourTypes: readonly TourType[], disabled?: boolean }>()
const model = defineModel<string>({ required: true })

const { t } = useI18n({ useScope: 'global' })
const scales = computed(() => gradeScales(props.tourTypes))
/** "ZS-" still is ZS. */
const base = computed(() => model.value.trim().replace(/[+\-−]+$/, ''))
</script>

<template>
  <div v-for="scale in scales" :key="scale.join()" class="scale" role="group" :aria-label="t('tours.form.gradeScale')">
    <button
      v-for="grade in scale" :key="grade" type="button" class="chip" :class="{ selected: base === grade }"
      :aria-pressed="base === grade" :disabled="disabled" data-testid="grade-chip" @click="model = grade"
    >
      {{ grade }}
    </button>
  </div>
</template>

<style scoped>
.scale {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxs);
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
