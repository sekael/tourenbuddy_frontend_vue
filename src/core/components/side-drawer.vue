<script setup lang="ts">
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Ignored on desktop; accepted so callers using a dynamic `:is` component can pass it uniformly. */
  collapsed?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const isDesktop = useIsDesktop()
</script>

<template>
  <BottomSheet
    v-if="!isDesktop"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    @close="emit('close')"
  >
    <slot />
  </BottomSheet>

  <!-- Desktop: right-edge side drawer, no backdrop -->
  <div
    v-else
    class="side-drawer"
    role="dialog"
    aria-modal="true"
    :aria-label="props.title ?? props.ariaLabel ?? 'Side drawer'"
  >
    <div class="drawer-header">
      <h2 v-if="props.title" class="drawer-title">
        {{ props.title }}
      </h2>
      <div v-else class="title-spacer" />
      <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
    <div class="drawer-content">
      <slot />
    </div>
    <div v-if="$slots.footer" class="drawer-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.side-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-left: 1px solid var(--color-outline-variant);
  box-shadow: var(--shadow-lg);
  animation: slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* Restore pointer events — parent sheet-container sets pointer-events: none */
  pointer-events: auto;
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.drawer-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.title-spacer {
  flex: 1;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.drawer-content {
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-xl);
  flex: 1;
  min-height: 0;
}

.drawer-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-outline-variant);
  padding: var(--spacing-sm) var(--spacing-xl) var(--spacing-xl);
}
</style>
