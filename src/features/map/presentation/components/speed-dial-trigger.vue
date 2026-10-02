<script setup lang="ts">
import BaseIcon from '@/core/components/base-icon.vue'

defineProps<{
  isOpen: boolean
  hasBadge?: boolean
  titleOpen: string
  titleClosed: string
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="wrap">
    <button
      class="fab"
      :class="{ open: isOpen }"
      data-tour="open-menu"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      aria-controls="speed-dial-menu"
      :title="isOpen ? titleOpen : titleClosed"
      @click="$emit('toggle')"
    >
      <BaseIcon name="menu" class="icon icon-menu" :class="{ hidden: isOpen }" />
      <BaseIcon name="close" class="icon icon-close" :class="{ hidden: !isOpen }" />
    </button>
    <span v-if="hasBadge && !isOpen" class="dot" aria-hidden="true" />
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--color-fab-surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-fab-on-surface);
  transition:
    background-color var(--motion-duration-medium) var(--motion-ease-standard),
    box-shadow var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.fab:hover {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 85%, transparent);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

/* Keeps the hover lift; adds the variant's press scale (Classic: 1 = unchanged). */
.fab:active:not(:disabled) {
  transform: translateY(-1px) scale(var(--press-scale));
}

.icon {
  position: absolute;
  transition: opacity 0.25s ease;
}

.icon.hidden {
  opacity: 0;
  pointer-events: none;
}

.dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--fab-dot-color, var(--color-primary));
  border: 2px solid var(--color-fab-surface);
  pointer-events: none;
}
</style>
