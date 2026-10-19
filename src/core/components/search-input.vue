<script setup lang="ts">
import { useTemplateRef } from 'vue'
import BaseIcon from './base-icon.vue'

/**
 * Search box: icon + native `type="search"` input (its built-in × clears the model),
 * plus a slot for trailing controls on the same row (e.g. a filters trigger).
 */
defineProps<{
  placeholder?: string
  /** Accessible name when no visible label exists. */
  label?: string
}>()

const emit = defineEmits<{
  enter: []
  escape: []
}>()

const query = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')

defineExpose({ blur: () => input.value?.blur(), focus: () => input.value?.focus() })
</script>

<template>
  <div class="search-row">
    <BaseIcon name="search" class="search-icon" />
    <input
      ref="input"
      v-model="query"
      type="search"
      class="search-input"
      :placeholder="placeholder"
      :aria-label="label"
      enterkeyhint="search"
      @keydown.enter.prevent="emit('enter')"
      @keydown.esc="emit('escape')"
    >
    <slot />
  </div>
</template>

<style scoped>
/* No `flex-wrap`: trailing slot controls stay on the row and the input shrinks instead,
   so a merged search + trigger row never grows a second line. */
.search-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--input-radius);
  background-color: var(--input-bg);
}

.search-icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
}
</style>
