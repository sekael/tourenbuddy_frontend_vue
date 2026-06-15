<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Mobile full-screen edit/create page. Replaces the bottom sheet whenever the
 * user is entering data, so the whole screen serves the form — no map behind,
 * no drag/snap, no keyboard-vs-sheet gap fighting. A fixed top app bar holds
 * the cancel control and a `page-action` slot (the consumer's Save button), so
 * the primary action is never hidden by the on-screen keyboard; the form body
 * scrolls beneath it.
 */
defineProps<{
  title?: string
  ariaLabel?: string
  /** Show a back arrow instead of the close (×) as the top-left cancel control. */
  showBack?: boolean
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })

const titleId = 'full-screen-page-title'
</script>

<template>
  <!-- Teleport to <body> so the page is never nested inside the bottom-sheet
       container. That container gets a `transform` during its open/close
       transition, which would make it the containing block for this
       `position: fixed` surface — collapsing the page into the sheet box and
       leaving a sliver of map above it. Escaping to <body> keeps the page
       resolved against the viewport at all times. -->
  <Teleport to="body">
    <div
      class="full-screen-page"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      :aria-label="!title ? (ariaLabel ?? t('core.drawer.back')) : undefined"
    >
      <header class="page-bar">
        <button
          type="button"
          class="cancel-btn"
          :aria-label="showBack ? t('core.drawer.back') : t('core.drawer.close')"
          @click="showBack ? emit('back') : emit('close')"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            {{ showBack ? 'arrow_back' : 'close' }}
          </span>
        </button>
        <h2 v-if="title" :id="titleId" class="title">
          {{ title }}
        </h2>
        <div v-else class="title-spacer" />
        <div class="page-action">
          <slot name="page-action" />
        </div>
      </header>

      <div class="content">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.full-screen-page {
  position: fixed;
  inset: 0;
  /* Layout-viewport height; the body scroller handles the keyboard, the fixed
     top bar keeps the Save action visible regardless of keyboard state. */
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  z-index: 60;
  pointer-events: auto;
}

.page-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  padding: calc(env(safe-area-inset-top, 0px) + var(--spacing-sm)) var(--spacing-md) var(--spacing-sm);
  border-bottom: 1px solid var(--color-outline-variant);
}

.cancel-btn {
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

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex: 1;
  min-width: 0;
}

.title-spacer {
  flex: 1;
}

.page-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* Shared primary look for any consumer's top-bar Save button (class
   `page-save-btn`), so the action bar is consistent across features. */
.page-action :slotted(.page-save-btn) {
  padding: var(--spacing-xs) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: background-color 0.2s;
}

.page-action :slotted(.page-save-btn:hover) {
  background-color: var(--color-primary-dark);
}

.page-action :slotted(.page-save-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-md) var(--spacing-md) calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
}
</style>
