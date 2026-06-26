<script setup lang="ts">
import { computed } from 'vue'
import BaseIcon from './base-icon.vue'

type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  /** Material Symbols ligature name. */
  name: string
  /** Accessible name — exposed via aria-label + title (icon glyph is decorative). */
  label: string
  size?: Size
  shape?: 'round' | 'square'
  /** 'danger' tints the glyph red on hover — for destructive actions (delete/remove). */
  tone?: 'default' | 'danger'
}>(), {
  size: 'md',
  shape: 'round',
  tone: 'default',
})

// Glyph tracks the button size so the icon stays proportionate to its target.
const iconSize = computed(() => props.size)
</script>

<template>
  <button
    type="button"
    class="base-icon-button"
    :class="[
      `base-icon-button--${props.size}`,
      `base-icon-button--${props.shape}`,
      `base-icon-button--${props.tone}`,
    ]"
    :aria-label="props.label"
    :title="props.label"
  >
    <BaseIcon :name="props.name" :size="iconSize" />
  </button>
</template>

<style scoped>
.base-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
  transition:
    background-color 0.15s,
    opacity 0.15s;
}

.base-icon-button:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

/* Danger tone: red glyph on hover, faint red wash instead of the neutral grey. */
.base-icon-button--danger:hover:not(:disabled) {
  color: var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 8%, transparent);
}

.base-icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.base-icon-button--sm {
  width: var(--icon-button-size-sm);
  height: var(--icon-button-size-sm);
}

.base-icon-button--md {
  width: var(--icon-button-size-md);
  height: var(--icon-button-size-md);
}

.base-icon-button--lg {
  width: var(--icon-button-size-lg);
  height: var(--icon-button-size-lg);
}

.base-icon-button--round {
  border-radius: 50%;
}

.base-icon-button--square {
  border-radius: var(--radius-sm);
}
</style>
