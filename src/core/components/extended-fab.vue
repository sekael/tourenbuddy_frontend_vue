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
/* Extended FAB: the primary action floating over a page — the primary button's
   fill and glow at FAB height. */
.ext-fab {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 52px;
  padding: 0 var(--spacing-xl);
  border-radius: var(--button-radius);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow:
    0 8px 20px -6px rgba(37, 99, 235, 0.55),
    var(--shadow-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
  cursor: pointer;
  transition:
    background-color var(--motion-duration-medium) var(--motion-ease-standard),
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.ext-fab:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.ext-fab:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.ext-fab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
