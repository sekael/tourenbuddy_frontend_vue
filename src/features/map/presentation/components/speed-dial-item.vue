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
    class="item"
    :disabled="disabled"
    :aria-disabled="disabled"
    :title="tooltip"
    @click="$emit('select')"
  >
    <span class="label">{{ label }}</span>
    <span class="icon-wrap">
      <slot name="badge" />
      <span class="material-symbols-outlined icon">{{ icon }}</span>
    </span>
  </button>
</template>

<style scoped>
.item {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-fab-surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(203, 213, 225, 0.5);
  box-shadow: var(--shadow-sm);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s,
    box-shadow 0.15s,
    transform 0.15s;
}

.item:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 85%, transparent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.label {
  flex: 1;
}

.icon-wrap {
  position: relative;
  width: 24px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  font-size: 20px;
}
</style>
