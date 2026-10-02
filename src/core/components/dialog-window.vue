<script setup lang="ts">
import BaseIconButton from './base-icon-button.vue'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to a header-only card; suppress backdrop-click dismissal and hide close button. */
  collapsed?: boolean
  showBack?: boolean
  /** Keep one height while the content switches views/tabs (no resize jumps). */
  stableSize?: boolean
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
      :class="{ 'dialog-card--collapsed': props.collapsed, 'dialog-card--stable': props.stableSize }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="props.title ? titleId : undefined"
      :aria-label="!props.title ? (props.ariaLabel ?? 'Dialog') : undefined"
    >
      <div class="dialog-header">
        <BaseIconButton
          v-if="props.showBack && !props.collapsed"
          name="arrow_back"
          class="overlay-action"
          size="sm"
          label="Back"
          @click="emit('back')"
        />
        <h2 v-if="props.title" :id="titleId" class="dialog-title">
          {{ props.title }}
        </h2>
        <div v-else class="title-spacer" />
        <slot name="header-actions" />
        <BaseIconButton
          v-if="!props.collapsed"
          name="close"
          class="overlay-action"
          size="sm"
          label="Close"
          @click="emit('close')"
        />
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
  background: var(--color-backdrop);
  backdrop-filter: blur(var(--overlay-backdrop-blur, 2px));
  -webkit-backdrop-filter: blur(var(--overlay-backdrop-blur, 2px));
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
  border: 1px solid var(--overlay-border-color, var(--color-outline-variant));
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 560px;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: dialog-enter var(--motion-duration-medium) var(--motion-ease-emphasized) both;
  pointer-events: auto;
  overflow: hidden;
  transition:
    max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Views/tabs swap inside a fixed frame; content scrolls. The collapsed state's
   max-height still clamps it. */
.dialog-card--stable {
  height: min(40rem, 90dvh);
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
  border-bottom: 1px solid var(--overlay-divider-color, var(--color-outline-variant));
}

.dialog-title {
  font-size: var(--overlay-title-size, var(--font-size-xl));
  font-weight: var(--font-weight-semibold);
  flex: 1;
  letter-spacing: var(--overlay-title-tracking, normal);
}

.title-spacer {
  flex: 1;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  /* Explicit: an unset overflow-x computes to `auto` alongside overflow-y here
     (CSS Overflow spec), which would silently open a horizontal scrollbar the
     moment any row's content is a pixel too wide. Dialogs scroll vertically only. */
  overflow-x: hidden;
  /* Overscroll stops here — never chains to the page behind the dialog. */
  overscroll-behavior: contain;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl) var(--spacing-lg);
  flex: 1;
  min-height: 0;
  scrollbar-gutter: stable;
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
  border-radius: var(--radius-pill);
}

.dialog-card--collapsed .dialog-content {
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  flex: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Header back/close: tonal circle in variants that define --overlay-close-bg. */
.overlay-action {
  background-color: var(--overlay-close-bg, transparent);
}
</style>
