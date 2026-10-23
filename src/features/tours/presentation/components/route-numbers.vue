<script setup lang="ts">
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'

/**
 * Climb · descent · distance as a guide reads them — "↑ 447 m  ↓ 1257 m  8.4 km" — each only
 * when known (design D19). The arrows are spelled out for assistive tech.
 */
defineProps<{
  metrics: RouteMetrics
  /** The way down is flown (activity-legs): the descent is the flight's drop. */
  flown?: boolean
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatElevation, formatDistance } = useFormatter()
</script>

<template>
  <span v-if="metrics.ascent !== null || metrics.descent !== null || metrics.distance !== null" class="route-numbers">
    <span v-if="metrics.ascent !== null" data-testid="route-ascent">
      <span aria-hidden="true">↑</span><span class="visually-hidden">{{ t('tours.route.ascent') }}</span>
      {{ formatElevation(metrics.ascent) }}
    </span>
    <span v-if="metrics.descent !== null" data-testid="route-descent">
      <BaseIcon v-if="flown" name="paragliding" size="xs" class="flown" />
      <span v-else aria-hidden="true">↓</span>
      <span class="visually-hidden">{{ flown ? t('tours.route.flight') : t('tours.route.descent') }}</span>
      {{ formatElevation(metrics.descent) }}
    </span>
    <span v-if="metrics.distance !== null" data-testid="route-distance">
      <span class="visually-hidden">{{ t('tours.route.distance') }}</span>
      {{ formatDistance(metrics.distance) }}
    </span>
  </span>
</template>

<style scoped>
.flown {
  vertical-align: -2px;
}

.route-numbers {
  display: inline-flex;
  flex-wrap: wrap;
  column-gap: var(--spacing-sm);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
