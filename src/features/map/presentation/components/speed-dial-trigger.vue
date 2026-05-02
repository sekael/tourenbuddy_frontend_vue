<script setup lang="ts">
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
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      aria-controls="speed-dial-menu"
      :title="isOpen ? titleOpen : titleClosed"
      @click="$emit('toggle')"
    >
      <span class="material-symbols-outlined icon">add</span>
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
    background-color 0.2s,
    box-shadow 0.2s,
    transform 0.15s;
}

.fab:hover {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 85%, transparent);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.icon {
  transition: transform 0.15s ease;
}

.fab.open .icon {
  transform: rotate(45deg);
}

.dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-primary);
  border: 2px solid var(--color-fab-surface);
  pointer-events: none;
}
</style>
