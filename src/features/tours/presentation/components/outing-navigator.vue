<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { outingDisplayName, outingKey, outingSegments } from '@/features/tours/domain/outing'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

/** Where a segment sits in its outing, with a way to the overview and the neighbours (#338). */
const props = defineProps<{ tour: Tour }>()
const emit = defineEmits<{ openOuting: [outingKey: string] }>()

const { t } = useI18n({ useScope: 'global' })
const mapStore = useMapStore()
const { tours, friendTours } = storeToRefs(useToursStore())

const key = computed(() => outingKey(props.tour))
const segments = computed(() => outingSegments([...tours.value, ...friendTours.value], key.value))
const index = computed(() => segments.value.findIndex(s => s.id === props.tour.id))
const prev = computed(() => segments.value[index.value - 1] ?? null)
const next = computed(() => segments.value[index.value + 1] ?? null)
</script>

<template>
  <nav v-if="key && index >= 0" class="navigator" :aria-label="t('tours.outing.openOverview')">
    <button type="button" class="outing" data-testid="outing-overview-link" @click="emit('openOuting', key)">
      <BaseIcon name="timeline" class="outing-icon" />
      <span class="outing-text">
        <span class="outing-name">{{ outingDisplayName(segments) }}</span>
        <span class="outing-position">{{ t('tours.outing.segmentOf', { n: index + 1, count: segments.length }) }}</span>
      </span>
    </button>
    <button
      type="button" class="step" :aria-label="t('tours.outing.previous')" :disabled="!prev"
      data-testid="segment-prev" @click="prev && mapStore.selectTour(prev.id)"
    >
      <BaseIcon name="chevron_left" />
    </button>
    <button
      type="button" class="step" :aria-label="t('tours.outing.next')" :disabled="!next"
      data-testid="segment-next" @click="next && mapStore.selectTour(next.id)"
    >
      <BaseIcon name="chevron_right" />
    </button>
  </nav>
</template>

<style scoped>
.navigator {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-variant);
}

.outing {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.outing-icon {
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
}

.outing-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.outing-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outing-position {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.step {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-on-surface);
  cursor: pointer;
}

.step:disabled {
  opacity: 0.3;
  cursor: default;
}

@media (hover: hover) {
  .outing:hover,
  .step:hover:not(:disabled) {
    background-color: var(--color-background);
  }
}
</style>
