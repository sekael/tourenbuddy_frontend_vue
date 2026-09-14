<script setup lang="ts">
import BaseIcon from '@/core/components/base-icon.vue'

/**
 * The one file tile: icon, filename, optional determinate progress, caller-supplied actions.
 *
 * Shared so a file in flight looks identical wherever it was picked — the GPX picker and the
 * attachment upload rows sat side by side in the same form with different borders, icon
 * colours and bar widths. Presentational only: no store, no upload knowledge, so both the
 * attachment rows (cancel / retry / dismiss) and the GPX row (replace / remove) can drive it.
 */
defineProps<{
  icon: string
  filename: string
  /** Fraction 0..1 while a transfer is in flight. Omit (or null) to render no bar at all. */
  progress?: number | null
  progressLabel?: string
  failed?: boolean
}>()
</script>

<template>
  <div class="upload-tile" :class="{ 'upload-tile--failed': failed }">
    <BaseIcon :name="icon" class="upload-tile__icon" />
    <div class="upload-tile__body">
      <span class="upload-tile__name">{{ filename }}</span>
      <!-- Native <progress>: determinate, accessible, and free of a hand-rolled bar. -->
      <progress
        v-if="progress != null"
        class="upload-tile__progress"
        :value="progress"
        max="1"
        :aria-label="progressLabel"
      />
      <slot name="status" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.upload-tile {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
  min-height: 40px;
}

.upload-tile--failed {
  border-color: var(--color-error);
}

.upload-tile__icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.upload-tile__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upload-tile__name {
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-tile__progress {
  width: 100%;
  height: 4px;
}
</style>
