<script setup lang="ts">
defineProps<{ label: string, disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button class="ext-fab" :disabled="disabled" @click="emit('click')">
    <slot name="icon" />
    <span class="ext-fab-label">{{ label }}</span>
  </button>
</template>

<style scoped>
/* Extended FAB: pill with icon + text. Mirrors round-action-button's surface,
   shadow and hover; round-action-button is icon-only so it can't be reused
   directly here. */
.ext-fab {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 52px;
  padding: 0 var(--spacing-lg);
  /* Match the calendar surface's corner radius so the FAB reads as part of it,
     not a detached pill. */
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    box-shadow var(--motion-duration-medium) var(--motion-ease-standard),
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.ext-fab:hover:not(:disabled) {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

/* Keeps the hover lift; adds the variant's press scale (Classic: 1 = unchanged). */
.ext-fab:active:not(:disabled) {
  transform: translateY(-1px) scale(var(--press-scale));
}

.ext-fab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
