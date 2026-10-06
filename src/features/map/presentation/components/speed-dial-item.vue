<script setup lang="ts">
import BaseIcon from '@/core/components/base-icon.vue'

// One glass pill per action: label, then icon. Used by the speed-dial menu and the
// base-map options alike, so every expanding map menu looks and moves the same.
// Choice items pass role="menuitemradio", aria-checked and the `selected` class.
defineProps<{
  icon: string
  label: string
  disabled?: boolean
  tooltip?: string
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    role="menuitem"
    class="item-row fab-glass"
    :disabled="disabled"
    :aria-disabled="disabled"
    :title="tooltip ?? label"
    :aria-label="tooltip ?? label"
    @click="$emit('select')"
  >
    <span class="label">{{ label }}</span>
    <span class="icon-wrap">
      <slot name="badge" />
      <BaseIcon :name="icon" class="icon" />
    </span>
  </button>
</template>

<style scoped>
.item-row {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 48px;
  /* 15px + 1px border + half the 20px icon = 26px: every icon centres on the
     52px trigger's vertical axis, so the menu reads as one column. */
  padding: 0 15px 0 var(--spacing-lg);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition:
    background-color var(--motion-duration-short) var(--motion-ease-standard),
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.item-row.selected {
  background-color: var(--color-fab-glass-strong);
}

@media (hover: hover) {
  .item-row:hover:not(:disabled) {
    background-color: var(--color-fab-glass-strong);
  }
}

.item-row:active:not(:disabled) {
  background-color: var(--color-fab-glass-strong);
}

.item-row.selected {
  font-weight: var(--font-weight-semibold);
}

.item-row:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.item-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-wrap {
  position: relative;
  display: flex;
}

.icon {
  font-size: var(--icon-size-md);
}
</style>
