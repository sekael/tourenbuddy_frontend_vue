<script setup lang="ts">
import BaseIcon from '@/core/components/base-icon.vue'

// A preview tile in the map layers panel. The caller sets the ARIA role/state
// (radio + aria-checked, or toggle + aria-pressed); `selected` drives the visuals.
const props = defineProps<{ label: string, thumbnail: string, selected: boolean, disabled?: boolean }>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button" class="tile" :class="{ selected: props.selected }" :disabled="props.disabled"
    @click="emit('select')"
  >
    <span class="thumb">
      <img :src="props.thumbnail" alt="" width="72" height="72">
      <Transition name="badge">
        <span v-if="props.selected" class="badge" aria-hidden="true">
          <BaseIcon name="check" size="xs" />
        </span>
      </Transition>
    </span>
    <span class="label">{{ props.label }}</span>
  </button>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xxs);
  width: calc(var(--tile-size, 72px) + var(--spacing-sm));
  padding: 0;
  border: none;
  background: none;
  color: var(--color-fab-on-surface);
  font: inherit;
  cursor: pointer;
  transition: transform var(--motion-duration-short) var(--motion-ease-spring);
}

.tile:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.tile:disabled {
  cursor: default;
  opacity: 0.5;
}

.thumb {
  position: relative;
  display: block;
  width: var(--tile-size, 72px);
  height: var(--tile-size, 72px);
  border-radius: var(--radius-md);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color var(--motion-duration-short) var(--motion-ease-standard);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  /* Unselected tiles recede so the active set reads at a glance. */
  filter: saturate(0.55);
  transition: filter var(--motion-duration-short) var(--motion-ease-standard);
}

.selected .thumb {
  outline-color: var(--color-accent);
}

.selected .thumb img {
  filter: none;
}

.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--color-accent);
  color: var(--white);
  border: 2px solid var(--color-fab-surface);
}

.badge-enter-active {
  transition: transform var(--motion-duration-short) var(--motion-ease-spring);
}

.badge-enter-from {
  transform: scale(0);
}

.label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .tile,
  .thumb,
  .thumb img,
  .badge-enter-active {
    transition: none;
  }
}
</style>
