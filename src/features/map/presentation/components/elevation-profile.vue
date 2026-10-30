<script setup lang="ts">
import type { LngLat } from '@/features/map/domain/entities/trail'
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { haversineMeters } from '@/core/utils/haversine'

/** Height over distance of a line, as the swisstopo app draws it under a tour: a red line on a filled area. */
const props = defineProps<{ line: LngLat[], heights: (number | null)[] }>()

const { formatElevation, formatDistance } = useFormatter()
const box = useTemplateRef<HTMLElement>('box')
const { width } = useElementSize(box)

const HEIGHT = 72
const LEFT = 44
const BOTTOM = 16
const TOP = 6

const stations = computed(() => {
  let walked = 0
  return props.line
    .map((p, i) => ({ d: (walked += i > 0 ? haversineMeters(props.line[i - 1]!, p) : 0), h: props.heights[i] }))
    .filter((s): s is { d: number, h: number } => s.h != null)
})

const chart = computed(() => {
  const s = stations.value
  if (s.length < 2 || width.value <= LEFT)
    return null
  const total = s.at(-1)!.d || 1
  const low = Math.min(...s.map(p => p.h))
  const high = Math.max(...s.map(p => p.h))
  // At least 50 m of range, so a flat walk doesn't draw as a mountain.
  const pad = Math.max(0, 50 - (high - low)) / 2
  const [min, max] = [low - pad, high + pad]
  const x = (d: number) => LEFT + d / total * (width.value - LEFT - 4)
  const y = (h: number) => TOP + (1 - (h - min) / (max - min)) * (HEIGHT - TOP - BOTTOM)
  const pts = s.map(p => `${x(p.d).toFixed(1)},${y(p.h).toFixed(1)}`)
  const base = HEIGHT - BOTTOM
  return {
    line: `M${pts.join('L')}`,
    area: `M${x(0)},${base}L${pts.join('L')}L${x(s.at(-1)!.d)},${base}Z`,
    first: { x: x(0), y: y(s[0]!.h) },
    last: { x: x(s.at(-1)!.d), y: y(s.at(-1)!.h) },
    labels: { high: formatElevation.value(Math.round(high)), low: formatElevation.value(Math.round(low)), total: formatDistance.value(total) },
    yHigh: y(high),
    yLow: y(low),
    right: width.value - 4,
  }
})
</script>

<template>
  <div ref="box" class="elevation-profile" aria-hidden="true">
    <svg v-if="chart" :width="width" :height="HEIGHT">
      <line class="grid" :x1="LEFT" :x2="chart.right" :y1="chart.yHigh" :y2="chart.yHigh" />
      <line class="grid" :x1="LEFT" :x2="chart.right" :y1="chart.yLow" :y2="chart.yLow" />
      <text class="label" :x="LEFT - 6" :y="chart.yHigh + 4" text-anchor="end">{{ chart.labels.high }}</text>
      <text class="label" :x="LEFT - 6" :y="chart.yLow + 4" text-anchor="end">{{ chart.labels.low }}</text>
      <text class="label" :x="LEFT" :y="HEIGHT - 2">0</text>
      <text class="label" :x="chart.right" :y="HEIGHT - 2" text-anchor="end">{{ chart.labels.total }}</text>
      <path class="area" :d="chart.area" />
      <path class="profile" :d="chart.line" />
      <circle class="end" :cx="chart.first.x" :cy="chart.first.y" r="3.5" />
      <circle class="end" :cx="chart.last.x" :cy="chart.last.y" r="3.5" />
    </svg>
  </div>
</template>

<style scoped>
.elevation-profile {
  height: 72px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
}

svg {
  display: block;
}

.grid {
  stroke: var(--color-outline-variant);
  stroke-width: 1;
  stroke-dasharray: 2 3;
}

.label {
  fill: var(--color-on-surface-variant);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.area {
  fill: color-mix(in srgb, #e3061b 12%, transparent);
}

.profile {
  fill: none;
  stroke: #e3061b;
  stroke-width: 2;
  stroke-linejoin: round;
}

.end {
  fill: #e3061b;
}
</style>
