<script setup lang="ts">
const props = defineProps<{
  title?: string
  disabled?: boolean
  glass?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button
    class="fab"
    :class="{ 'fab--glass': props.glass }"
    :title="props.title"
    :disabled="props.disabled"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>

<style scoped>
.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    box-shadow var(--motion-duration-medium) var(--motion-ease-standard),
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
  color: var(--color-on-surface-variant);
}

.fab:hover:not(:disabled) {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

/* Keeps the hover lift; adds the variant's press scale (Classic: 1 = unchanged). */
.fab:active:not(:disabled) {
  transform: translateY(-1px) scale(var(--press-scale));
}

.fab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fab--glass {
  background-color: rgba(248, 250, 252, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(203, 213, 225, 0.5);
}
</style>
