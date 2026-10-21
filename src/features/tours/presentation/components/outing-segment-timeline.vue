<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { cssFill, distinctTypeColors, TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS } from '@/features/tours/data/models/tour-type'

/** The outing's segments as a numbered timeline (#338). `editing` swaps the chevron for move/remove. */
defineProps<{ segments: Tour[], editing?: boolean, busy?: boolean }>()
const emit = defineEmits<{
  open: [tourId: string]
  move: [index: number, direction: -1 | 1]
  remove: [tourId: string]
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatDate, formatNumber } = useFormatter()

/** Numbered dot in the segment's activity colours — the same split its map marker wears. */
function dotStyle(segment: Tour) {
  const colors = distinctTypeColors(segment.tourTypes, TOUR_TYPE_COLORS)
  return colors.length > 0 ? { background: cssFill(colors) } : undefined
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
    <li v-for="(segment, i) in segments" :key="segment.id" class="segment" data-testid="outing-segment">
      <button type="button" class="segment-main" :disabled="editing" @click="emit('open', segment.id)">
        <span class="dot" :style="dotStyle(segment)">{{ i + 1 }}</span>
        <span class="text">
          <span class="name">{{ segment.name ?? t('tours.infoSheet.unnamedTour') }}</span>
          <span v-if="details(segment)" class="meta">{{ details(segment) }}</span>
        </span>
        <BaseIcon v-if="!editing" name="chevron_right" class="chevron" />
      </button>
      <div v-if="editing" class="edit-actions">
        <button
          type="button" class="icon-btn" :aria-label="t('tours.outing.moveUp')" :disabled="busy || i === 0"
          data-testid="segment-up" @click="emit('move', i, -1)"
        >
          <BaseIcon name="arrow_upward" />
        </button>
        <button
          type="button" class="icon-btn" :aria-label="t('tours.outing.moveDown')"
          :disabled="busy || i === segments.length - 1" data-testid="segment-down" @click="emit('move', i, 1)"
        >
          <BaseIcon name="arrow_downward" />
        </button>
        <button
          type="button" class="icon-btn icon-btn--danger" :aria-label="t('tours.outing.remove')" :disabled="busy"
          data-testid="segment-remove" @click="emit('remove', segment.id)"
        >
          <BaseIcon name="remove_circle_outline" />
        </button>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.segment {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

/* The rail joining consecutive dots: from this dot's centre down to the next one's. */
.segment:not(:last-child)::before {
  content: '';
  position: absolute;
  left: calc(var(--spacing-sm) + 13px);
  top: 50%;
  height: 100%;
  border-left: 2px dashed var(--color-outline-variant);
}

.segment-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--motion-duration-short) var(--motion-ease-standard);
}

.segment-main:disabled {
  cursor: default;
}

@media (hover: hover) {
  .segment-main:hover:not(:disabled) {
    background-color: var(--color-surface-variant);
  }
}

.dot {
  position: relative;
  z-index: 1;
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
  box-shadow: 0 0 0 3px var(--color-background);
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

.chevron {
  flex-shrink: 0;
  color: var(--color-outline-variant);
}

.edit-actions {
  display: flex;
  flex-shrink: 0;
}

.icon-btn {
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
