<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { cssFill, distinctTypeColors, TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS } from '@/features/tours/data/models/tour-type'
import RouteNumbers from '@/features/tours/presentation/components/route-numbers.vue'

/**
 * One stage of an outing as a card (#338): number, name with goal height, activity · grade · date, climb
 * and descent. While editing it is the unit that is dragged around — by its handle — or removed.
 */
const props = defineProps<{
  segment: Tour
  /** 1-based position. */
  n: number
  metrics: RouteMetrics
  editing?: boolean
  busy?: boolean
  /** The handle's pointer/key listeners (`useHandleReorder`); none while busy. */
  handle?: Record<string, unknown>
  dragging?: boolean
  /** The dragged card would land here. */
  over?: boolean
  /** Vertical px the dragged card has travelled. */
  offset?: number
}>()
const emit = defineEmits<{ open: [], remove: [] }>()

const { t } = useI18n({ useScope: 'global' })
const { formatDate, formatElevation } = useFormatter()

/** Numbered dot in the segment's activity colours — the same split its map marker wears. */
const dotStyle = computed(() => {
  const colors = distinctTypeColors(props.segment.tourTypes, TOUR_TYPE_COLORS)
  return colors.length > 0 ? { background: cssFill(colors) } : undefined
})

const meta = computed(() => [
  props.segment.tourTypes.map(type => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`)).join(', ') || null,
  props.segment.grade,
  props.segment.plannedDate
    ? formatDate.value(props.segment.plannedDate, { weekday: 'short', day: 'numeric', month: 'short' })
    : null,
].filter(Boolean).join(' · '))
</script>

<template>
  <div
    class="card"
    :class="{ 'card--editing': editing, 'card--dragging': dragging, 'card--over': over }"
    :style="dragging ? { transform: `translateY(${offset ?? 0}px)` } : undefined"
  >
    <button
      v-if="editing" type="button" class="handle" :aria-label="t('tours.outing.reorderHandle', { n })"
      :disabled="busy" data-testid="segment-handle" v-bind="handle"
    >
      <BaseIcon name="drag_indicator" />
    </button>
    <button type="button" class="main" :disabled="editing" @click="emit('open')">
      <span class="dot" :style="dotStyle">{{ n }}</span>
      <span class="text">
        <span class="title">
          <span class="name">{{ segment.name ?? t('tours.infoSheet.unnamedTour') }}</span>
          <span v-if="segment.elevation != null" class="height">{{ formatElevation(segment.elevation) }}</span>
        </span>
        <span v-if="meta" class="meta">{{ meta }}</span>
        <RouteNumbers class="meta" :metrics="metrics" />
      </span>
      <BaseIcon v-if="!editing" name="chevron_right" class="chevron" />
    </button>
    <button
      v-if="editing" type="button" class="remove" :aria-label="t('tours.outing.remove')"
      :disabled="busy" data-testid="segment-remove" @click="emit('remove')"
    >
      <BaseIcon name="remove_circle_outline" />
    </button>
  </div>
</template>

<style scoped>
/* A stage card: one self-contained block, the unit that is dragged around. Its dot sits at the
   timeline's `--dot-x`, so the links between cards run through the dots. */
.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--card-radius);
  background: var(--color-background);
  box-shadow: var(--shadow-sm);
  transition:
    border-color var(--motion-duration-short) var(--motion-ease-standard),
    background-color var(--motion-duration-short) var(--motion-ease-standard),
    box-shadow var(--motion-duration-short) var(--motion-ease-standard);
}

.card--editing {
  padding-inline-start: var(--spacing-xxs);
}

/* Lifted and following the pointer. */
.card--dragging {
  z-index: 1;
  box-shadow: var(--shadow-lg);
  transition: none;
}

/* Where the dragged card would land: a 2 px outline (no layout shift) on a tinted card. */
.card--over {
  outline: 2px dashed var(--color-primary);
  outline-offset: -1px;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
}

@media (hover: hover) {
  .card:has(.main:hover:not(:disabled)) {
    border-color: var(--color-outline);
    background: var(--color-surface);
  }
}

/* 44 px: a finger-sized grip; `touch-action: none` keeps the sheet from scrolling under it. */
.handle,
.remove {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-on-surface-variant);
}

.handle {
  cursor: grab;
  touch-action: none;
}

.card--dragging .handle {
  cursor: grabbing;
}

.remove {
  color: var(--color-error);
  cursor: pointer;
}

.handle:disabled,
.remove:disabled {
  opacity: 0.35;
  cursor: default;
}

@media (hover: hover) {
  .handle:hover:not(:disabled),
  .remove:hover:not(:disabled) {
    background-color: var(--color-surface-variant);
  }
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-xs);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card--editing .main {
  padding-inline: 0;
}

.main:disabled {
  cursor: inherit;
}

.dot {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.title {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
  min-width: 0;
}

.name {
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.height {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

.meta {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.chevron {
  flex-shrink: 0;
  color: var(--color-outline-variant);
}
</style>
