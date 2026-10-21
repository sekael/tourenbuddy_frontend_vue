<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { cssFill, distinctTypeColors, TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS } from '@/features/tours/data/models/tour-type'
import { outingGaps } from '@/features/tours/domain/outing'

/**
 * The outing's segments as a numbered timeline (#338). `editing` swaps the chevron for a drag
 * handle (reorder, like attachments) and remove. A segment starting away from where the previous
 * one finishes says so — the order or a point may be off, or it's a transfer.
 */
const props = defineProps<{ segments: Tour[], editing?: boolean, busy?: boolean }>()
const emit = defineEmits<{
  open: [tourId: string]
  reorder: [from: number, to: number]
  remove: [tourId: string]
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatDate, formatNumber } = useFormatter()

/** Numbered dot in the segment's activity colours — the same split its map marker wears. */
function dotStyle(segment: Tour) {
  const colors = distinctTypeColors(segment.tourTypes, TOUR_TYPE_COLORS)
  return colors.length > 0 ? { background: cssFill(colors) } : undefined
}

const gapAt = computed(() => new Set(outingGaps(props.segments).map(g => g.index)))

// ── Drag-to-reorder (same native DnD as the attachments list) ────────────────
const dragFrom = ref<number | null>(null)
/** The card the dragged one would land on — highlighted as the drop target. */
const dragOver = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  dragFrom.value = index
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  dragOver.value = index
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
}

function onDragEnd() {
  dragFrom.value = null
  dragOver.value = null
}

function onDrop(to: number) {
  const from = dragFrom.value
  onDragEnd()
  if (from !== null && from !== to)
    emit('reorder', from, to)
}

function details(segment: Tour): string {
  return [
    segment.tourTypes.map(type => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`)).join(', ') || null,
    segment.plannedDate ? formatDate.value(segment.plannedDate, { weekday: 'short', day: 'numeric', month: 'short' }) : null,
    // No space before the unit, like the rest of the app — and it can't wrap onto its own line.
    segment.elevation != null ? `${formatNumber.value(segment.elevation, { maximumFractionDigits: 0 })}m` : null,
  ].filter(Boolean).join(' · ')
}
</script>

<template>
  <ol class="timeline">
    <li
      v-for="(segment, i) in segments" :key="segment.id" class="segment" data-testid="outing-segment"
      :class="{
        'segment--editing': editing,
        'segment--gap': gapAt.has(i),
        'segment--dragging': dragFrom === i,
        'segment--over': dragOver === i && dragFrom !== null && dragFrom !== i,
      }"
      :draggable="editing && !busy"
      @dragstart="onDragStart(i, $event)" @dragover="onDragOver(i, $event)" @drop="onDrop(i)" @dragend="onDragEnd"
    >
      <BaseIcon v-if="editing" name="drag_indicator" class="drag-handle" />
      <button type="button" class="segment-main" :disabled="editing" @click="emit('open', segment.id)">
        <span class="dot" :style="dotStyle(segment)">{{ i + 1 }}</span>
        <span class="text">
          <span class="name">{{ segment.name ?? t('tours.infoSheet.unnamedTour') }}</span>
          <span v-if="details(segment)" class="meta">{{ details(segment) }}</span>
          <span v-if="gapAt.has(i)" class="gap" data-testid="segment-gap">
            <BaseIcon name="info" size="sm" />
            {{ t('tours.outing.gapHint', { n: i }) }}
          </span>
        </span>
        <BaseIcon v-if="!editing" name="chevron_right" class="chevron" />
      </button>
      <button
        v-if="editing" type="button" class="icon-btn icon-btn--danger" :aria-label="t('tours.outing.remove')"
        :disabled="busy" data-testid="segment-remove" @click="emit('remove', segment.id)"
      >
        <BaseIcon name="remove_circle_outline" />
      </button>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  /* Space between cards; the dashed connector spans it. */
  --card-gap: var(--spacing-sm);
  /* Dot centre from the card's left edge: border + padding (+ drag handle while editing) + half a dot. */
  --dot-x: calc(1px + 2 * var(--spacing-xs) + 14px);

  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--card-gap);
}

/* A stage card: one self-contained block, the unit that is dragged around. */
.segment {
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
    opacity var(--motion-duration-short) var(--motion-ease-standard);
}

/* Connector from the previous card's dot line into this one; amber where the chain breaks. */
.segment:not(:first-child)::before {
  content: '';
  position: absolute;
  left: calc(var(--dot-x) - 1px - 1px);
  bottom: 100%;
  height: calc(var(--card-gap) + 2px);
  border-left: 2px dashed var(--color-outline-variant);
}

.segment--gap:not(:first-child)::before {
  border-left-color: var(--color-warning);
}

.segment--editing {
  --dot-x: calc(1px + var(--spacing-xs) + 24px + var(--spacing-xxs) + var(--spacing-sm) + 14px);
}

.segment--editing[draggable='true'] {
  cursor: grab;
}

.segment--dragging {
  opacity: 0.4;
}

.segment--over {
  border-style: dashed;
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
}

@media (hover: hover) {
  .segment:has(.segment-main:hover:not(:disabled)) {
    border-color: var(--color-outline);
    background: var(--color-surface);
  }
}

.drag-handle {
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
}

.segment-main {
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

.segment--editing .segment-main {
  padding-inline: var(--spacing-sm) 0;
  cursor: inherit;
}

.segment-main:disabled {
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

.name {
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.gap {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  margin-top: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  color: var(--color-warning-text);
}

.chevron {
  flex-shrink: 0;
  color: var(--color-outline-variant);
}

.icon-btn {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

@media (hover: hover) {
  .icon-btn:hover:not(:disabled) {
    background-color: var(--color-surface-variant);
  }
}

.icon-btn--danger {
  color: var(--color-error);
}
</style>
