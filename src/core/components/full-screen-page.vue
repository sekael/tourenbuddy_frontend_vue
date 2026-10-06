<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import { useExitAnimation } from '@/core/composables/use-exit-animation'

/**
 * Mobile full-screen edit/create page. Replaces the bottom sheet whenever the
 * user is entering data, so the whole screen serves the form — no map behind,
 * no drag/snap, no keyboard-vs-sheet gap fighting. A fixed top app bar holds
 * the cancel control and a `page-action` slot (the consumer's Save button), so
 * the primary action is never hidden by the on-screen keyboard; the form body
 * scrolls beneath it.
 *
 * Motion: rises in on mount; on unmount (switching back to the sheet, or closing)
 * it fades out over whatever replaced it — a fade-through, so going sheet ⇄ page
 * never hard-cuts.
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

const pageRef = ref<HTMLElement | null>(null)
useExitAnimation(pageRef, token => ({
  frames: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${token('--motion-offset')})` }],
  duration: token('--motion-duration-short'),
  easing: token('--motion-ease-standard'),
}))
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
      ref="pageRef"
      class="full-screen-page"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      :aria-label="!title ? (ariaLabel ?? t('core.drawer.back')) : undefined"
    >
      <header class="page-bar">
        <BaseIconButton
          :name="showBack ? 'arrow_back' : 'close'"
          variant="tonal"
          size="sm"
          :label="showBack ? t('core.drawer.back') : t('core.drawer.close')"
          @click="showBack ? emit('back') : emit('close')"
        />
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
  animation: page-in var(--motion-duration-medium) var(--motion-ease-emphasized) both;
}

@keyframes page-in {
  from {
    opacity: 0;
    transform: translateY(var(--motion-offset));
  }
}

.page-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  padding: calc(var(--safe-top) + var(--spacing-sm)) var(--spacing-md) var(--spacing-sm);
}

.title {
  font-size: var(--overlay-title-size);
  font-weight: var(--font-weight-semibold);
  flex: 1;
  min-width: 0;
  letter-spacing: var(--overlay-title-tracking);
}

.title-spacer {
  flex: 1;
}

.page-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-md) var(--spacing-md) calc(var(--spacing-md) + var(--safe-bottom));
}
</style>
