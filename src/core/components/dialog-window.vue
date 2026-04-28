<script setup lang="ts">
const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to a header-only card; suppress backdrop-click dismissal and hide close button. */
  collapsed?: boolean
  showBack?: boolean
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const titleId = 'dialog-window-title'

function handleBackdropClick() {
  if (props.collapsed)
    return
  emit('close')
}
</script>

<template>
  <div
    class="dialog-backdrop"
    :class="{ 'dialog-backdrop--collapsed': props.collapsed }"
    @click.self="handleBackdropClick"
  >
    <div
      class="dialog-card"
      :class="{ 'dialog-card--collapsed': props.collapsed }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="props.title ? titleId : undefined"
      :aria-label="!props.title ? (props.ariaLabel ?? 'Dialog') : undefined"
    >
      <div class="dialog-header">
        <button
          v-if="props.showBack && !props.collapsed"
          type="button"
          class="back-btn"
          aria-label="Back"
          @click="emit('back')"
        >
          <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
        </button>
        <h2 v-if="props.title" :id="titleId" class="dialog-title">
          {{ props.title }}
        </h2>
        <div v-else class="title-spacer" />
        <button
          v-if="!props.collapsed"
          type="button"
          class="close-btn"
          aria-label="Close"
          @click="emit('close')"
        >
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
      <div
        class="dialog-content"
        :inert="props.collapsed || undefined"
        :aria-hidden="props.collapsed || undefined"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  transition:
    background 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    backdrop-filter 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* When picking a location: remove backdrop, push card to top-right */
.dialog-backdrop--collapsed {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: none;
  align-items: flex-start;
  justify-content: flex-center;
}

.dialog-card {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 560px;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: dialog-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
  pointer-events: auto;
  overflow: hidden;
  transition:
    max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Collapsed: header-only bar anchored to top-center, matching side-drawer--collapsed.
   animation-name intentionally NOT overridden here — same pattern as side-drawer.vue —
   so toggling collapsed off does not restart dialog-enter. */
.dialog-card--collapsed {
  max-width: 400px;
  max-height: 4.5rem;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  pointer-events: auto;
}

.dialog-card--collapsed .dialog-header {
  border-bottom: none;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.dialog-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.title-spacer {
  flex: 1;
}

.back-btn {
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

.back-btn:hover {
  background-color: var(--color-surface-variant);
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

.dialog-content {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-xl);
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-outline-variant) transparent;
  opacity: 1;
  transition:
    opacity 0.18s ease-out,
    padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dialog-content::-webkit-scrollbar {
  width: 5px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background-color: var(--color-outline-variant);
  border-radius: 9999px;
}

.dialog-card--collapsed .dialog-content {
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  flex: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
