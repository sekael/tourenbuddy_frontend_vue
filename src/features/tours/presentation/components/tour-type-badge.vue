<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import { computed } from 'vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_COLORS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

/**
 * A tour's activities as one disc: one activity fills it, several cut it into equal slices on a
 * diagonal (first activity top-left), each in its colour with its icon drawn large and pushed
 * into the slice — the seam and the rim crop it. None is a neutral pin. The consumer sizes it;
 * state stamps go in the default slot, outside the clipped disc.
 */
const props = defineProps<{ types: readonly TourType[] }>()

/** First seam, clockwise from 12 o'clock: two activities split along "/". */
const START_DEG = -135
// Glyph size and how far it sits from the centre (share of the radius) by slice count.
// ponytail: from four slices on the glyphs stop shrinking and crowd — add a "+n" slice if
// tours with five or more activities show up.
const ICON_PX = [24, 30, 24, 20]
const OFFSET = [0, 0.32, 0.45, 0.5]

/** A CSS position at `deg` and `r` (% of the disc size) from the centre. */
function at(deg: number, r: number) {
  const a = (deg * Math.PI) / 180
  return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) }
}

const slices = computed(() => {
  const n = props.types.length
  const k = Math.min(n, 4) - 1
  const step = 360 / n
  // Wedge corners twice the radius out, one at least every 90°, so the straight edges stay
  // outside the disc and its round clip draws the rim.
  const corners = Math.ceil(step / 90)
  return props.types.map((type, i) => {
    const from = START_DEG + i * step
    const icon = at(from + step / 2, 50 * OFFSET[k]!)
    const arc = Array.from({ length: corners + 1 }, (_, j) => at(from + (j * step) / corners, 100))
    return {
      type,
      style: {
        background: TOUR_TYPE_COLORS[type],
        clipPath: n > 1 ? `polygon(50% 50%, ${arc.map(p => `${p.x}% ${p.y}%`).join(', ')})` : undefined,
      },
      iconStyle: { left: `${icon.x}%`, top: `${icon.y}%`, fontSize: `${ICON_PX[k]}px` },
    }
  })
})
const seams = computed(() =>
  props.types.length > 1 ? props.types.map((_, i) => START_DEG + (i * 360) / props.types.length) : [],
)
</script>

<template>
  <span class="type-badge" aria-hidden="true">
    <span class="disc">
      <BaseIcon v-if="!types.length" name="location_on" size="lg" />
      <span v-for="slice in slices" :key="slice.type" class="slice" :style="slice.style">
        <BaseIcon :name="TOUR_TYPE_ICONS[slice.type]" class="slice-icon" :style="slice.iconStyle" />
      </span>
      <!-- Seams in the card colour keep two same-colour activities (ski tour + splitboard) apart. -->
      <span v-for="deg in seams" :key="deg" class="seam" :style="{ transform: `rotate(${deg}deg)` }" />
    </span>
    <slot />
  </span>
</template>

<style scoped>
.type-badge {
  position: relative;
}

.disc {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-on-surface-variant);
  color: var(--color-on-primary);
}

.slice {
  position: absolute;
  inset: 0;
}

.slice-icon {
  position: absolute;
  transform: translate(-50%, -50%);
}

.seam {
  position: absolute;
  top: 0;
  left: calc(50% - 1px);
  width: 2px;
  height: 50%;
  background: var(--color-background);
  transform-origin: 50% 100%;
}
</style>
