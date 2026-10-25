<script setup lang="ts">
import type { Flight, FlownWay } from '@/features/tours/domain/legs'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

/**
 * Climb · descent · distance as a guide reads them — "↑ 447 m  ↓ 1257 m  8.4 km" — each only
 * when known (design D19); a zero leg — a tour that ends at its goal — says nothing and stays
 * out. The arrows are spelled out for assistive tech.
 */
defineProps<{
  metrics: RouteMetrics
  /**
   * The flown ways (activity-legs): the arrow, then the way's activities — the glider alone for
   * a pure flight (a flown descent is the flight's drop), the others before it on a shared way.
   */
  flight?: Flight
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatElevation, formatDistance } = useFormatter()
const LABELS = {
  ascent: ['tours.route.ascent', 'tours.route.flightUp', 'tours.route.ascentPartFlown'],
  descent: ['tours.route.descent', 'tours.route.flight', 'tours.route.descentPartFlown'],
} as const
const label = (way: keyof typeof LABELS, flown: FlownWay | undefined) => t(LABELS[way][Math.min(flown?.length ?? 0, 2)])
</script>

<template>
  <span v-if="metrics.ascent || metrics.descent || metrics.distance !== null" class="route-numbers">
    <span v-if="metrics.ascent" data-testid="route-ascent">
      <span aria-hidden="true">↑</span>
      <BaseIcon v-for="type in flight?.up" :key="type" :name="TOUR_TYPE_ICONS[type]" size="xs" class="flown" />
      <span class="visually-hidden">{{ label('ascent', flight?.up) }}</span>
      {{ formatElevation(metrics.ascent) }}
    </span>
    <span v-if="metrics.descent" data-testid="route-descent">
      <span aria-hidden="true">↓</span>
      <BaseIcon v-for="type in flight?.down" :key="type" :name="TOUR_TYPE_ICONS[type]" size="xs" class="flown" />
      <span class="visually-hidden">{{ label('descent', flight?.down) }}</span>
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
