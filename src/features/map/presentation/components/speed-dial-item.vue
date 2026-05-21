<script setup lang="ts">
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
    class="item-row"
    :disabled="disabled"
    :aria-disabled="disabled"
    :title="tooltip ?? label"
    :aria-label="tooltip ?? label"
    @click="$emit('select')"
  >
    <span class="label-chip">{{ label }}</span>
    <span class="icon-fab">
      <slot name="badge" />
      <span class="material-symbols-outlined icon">{{ icon }}</span>
    </span>
  </button>
</template>

<style scoped>
.item-row {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s;
}

.item-row:hover:not(:disabled) {
  transform: translateY(-1px);
}

.item-row:hover:not(:disabled) .icon-fab {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 90%, transparent);
  box-shadow: var(--shadow-lg);
}

.item-row:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.label-chip {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-fab-surface) 90%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-sm);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.icon-fab {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--color-fab-surface) 90%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-fab-on-surface);
  flex-shrink: 0;
  transition:
    background-color 0.15s,
    box-shadow 0.15s;
}

.icon {
  font-size: 20px;
}

@media (orientation: landscape) and (max-height: 500px) {
  /* Arc layout: icon-only; tooltip via aria-label/title. */
  .item-row {
    gap: 0;
  }

  .label-chip {
    display: none;
  }
}
</style>
