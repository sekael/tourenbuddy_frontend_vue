<script setup lang="ts">
import BaseIcon from '@/core/components/base-icon.vue'

defineProps<{
  isOpen: boolean
  /** Inbox attention count, mirrored from the menu entry (friend requests included). */
  count?: number
  titleOpen: string
  titleClosed: string
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="wrap">
    <button
      class="fab fab-glass"
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
    <span v-if="count && !isOpen" class="count" data-testid="trigger-count" aria-hidden="true">
      {{ count > 9 ? '9+' : count }}
    </span>
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
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color var(--motion-duration-medium) var(--motion-ease-standard),
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.fab.open {
  background-color: var(--color-fab-glass-strong);
}

@media (hover: hover) {
  .fab:hover {
    background-color: var(--color-fab-glass-strong);
  }
}

.fab:active {
  background-color: var(--color-fab-glass-strong);
}

.fab:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

/* Menu ⇄ close: the glyphs cross-fade while turning a quarter, so the button
   reads as one control changing state rather than two icons swapping. */
.icon {
  position: absolute;
  transition:
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.icon.hidden {
  opacity: 0;
  pointer-events: none;
}

.icon-menu.hidden {
  transform: rotate(90deg) scale(0.8);
}

.icon-close.hidden {
  transform: rotate(-90deg) scale(0.8);
}

/* Same pill as the menu item badges, so the count reads as one signal in two places. */
.count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background-color: var(--color-fab-on-surface);
  color: var(--color-primary-dark);
  border: 2px solid var(--color-fab-surface);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
</style>
