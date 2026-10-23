<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useHandleReorder } from '@/core/composables/use-handle-reorder'
import { outingDateConflicts, outingGaps, outingNights, segmentFinishPlace } from '@/features/tours/domain/outing'
import OutingSegmentCard from '@/features/tours/presentation/components/outing-segment-card.vue'

/**
 * The outing's segments as a stage plan (#338, design D20): numbered cards, and between two of
 * them what happens there — the night (on a later day), the place handed over at (a segment ending
 * away from its goal), a gap (the next one starts elsewhere — a reorder, a moved point, or a
 * transfer) or dates out of order. Problems are shown; a gap can be closed by the owner in one tap
 * (`canConnect`: the previous segment then ends where the next starts). `editing` adds drag
 * handles (mouse, pen, finger, arrow keys) and remove.
 */
const props = defineProps<{
  segments: Tour[]
  metrics: Map<string, RouteMetrics>
  editing?: boolean
  busy?: boolean
  /** The owner may close a gap (smarter-tour-creation D8). */
  canConnect?: boolean
}>()
const emit = defineEmits<{
  open: [tourId: string]
  reorder: [from: number, to: number]
  remove: [tourId: string]
  /** End segment `index - 1` where segment `index` starts. */
  connect: [index: number]
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatElevation } = useFormatter()
const { from, over, offset, handleProps } = useHandleReorder((a, b) => emit('reorder', a, b))

const UNKNOWN: RouteMetrics = { ascent: null, descent: null, distance: null }

/** The link above each segment after the first. */
const links = computed(() => {
  const gaps = new Set(outingGaps(props.segments).map(g => g.index))
  const nights = outingNights(props.segments)
  const early = outingDateConflicts(props.segments)
  return props.segments.map((_, i) => {
    const prev = props.segments[i - 1]
    if (!prev)
      return null
    const night = nights.has(i)
    const { name, elevation } = segmentFinishPlace(prev)
    const place = name && (night || prev.endPoint)
      ? [name, elevation != null ? formatElevation.value(elevation) : null].filter(Boolean).join(' · ')
      : null
    return { night, place, gap: gaps.has(i), early: early.has(i) }
  })
})
</script>

<template>
  <ol class="timeline" :class="{ 'timeline--editing': editing }">
    <li
      v-for="(segment, i) in segments" :key="segment.id" class="stop" :data-reorder-index="i"
      data-testid="outing-segment"
    >
      <div v-if="links[i]" class="link" :class="{ 'link--warn': links[i]!.gap || links[i]!.early }">
        <span v-if="links[i]!.night" class="link-row" data-testid="segment-night">
          <BaseIcon name="bed" size="sm" />
          {{ [t('tours.outing.night'), links[i]!.place].filter(Boolean).join(' · ') }}
        </span>
        <span v-else-if="links[i]!.place" class="link-row" data-testid="segment-handover">{{ links[i]!.place }}</span>
        <span v-if="links[i]!.gap" class="link-row link-row--warn" data-testid="segment-gap">
          <BaseIcon name="warning" size="sm" />
          {{ t('tours.outing.gapHint', { n: i }) }}
          <button
            v-if="canConnect && segment.startPoint" type="button" class="connect" :disabled="busy"
            :aria-label="t('tours.outing.connectLabel', { n: i, place: segment.startPointName ?? t('tours.outing.connect') })"
            data-testid="segment-connect" @click="emit('connect', i)"
          >
            {{ t('tours.outing.connect') }}
          </button>
        </span>
        <span v-if="links[i]!.early" class="link-row link-row--warn" data-testid="segment-early">
          <BaseIcon name="warning" size="sm" />
          {{ t('tours.outing.dateBeforeHint', { n: i }) }}
        </span>
      </div>
      <OutingSegmentCard
        :segment="segment" :n="i + 1" :metrics="metrics.get(segment.id) ?? UNKNOWN" :editing="editing"
        :busy="busy" :handle="busy ? undefined : handleProps(i, segments.length)" :dragging="from === i"
        :over="over === i && from !== null && from !== i" :offset="offset"
        @open="emit('open', segment.id)" @remove="emit('remove', segment.id)"
      />
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  /* Dot centre from a card's left edge: border + padding (+ handle while editing) + half a dot. */
  --dot-x: calc(1px + 2 * var(--spacing-xs) + 14px);

  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.timeline--editing {
  --dot-x: calc(1px + 2 * var(--spacing-xxs) + 44px + 14px);
}

/* Between two cards: a dashed line through the dots (amber where the chain breaks), and beside it
   what happens there. */
.link {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-height: var(--spacing-sm);
  padding-inline-start: calc(var(--dot-x) + var(--spacing-md));
}

.link:has(.link-row) {
  padding-block: var(--spacing-xs);
}

.link::before {
  content: '';
  position: absolute;
  inset-block: 0;
  left: calc(var(--dot-x) - 1px);
  border-left: 2px dashed var(--color-outline-variant);
}

.link--warn::before {
  border-left-color: var(--color-warning);
}

.link-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.link-row--warn {
  color: var(--color-warning-text);
}

.connect {
  margin-inline-start: var(--spacing-xxs);
  min-height: 32px;
  padding: 0 var(--spacing-sm);
  border: 1px solid currentcolor;
  border-radius: var(--radius-pill);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.connect:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
