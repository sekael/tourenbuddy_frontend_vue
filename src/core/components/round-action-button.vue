<script setup lang="ts">
const props = defineProps<{
  title?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button class="fab" :title="props.title" :disabled="props.disabled" @click="emit('click')">
    <slot />
  </button>
</template>

<style scoped>
.fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition:
    box-shadow 0.2s,
    opacity 0.2s;
}

.fab:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.fab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
