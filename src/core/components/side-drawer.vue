<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /**
   * Collapse to a compact header — on desktop renders as a top-right header bar with title only;
   *  on mobile, delegates to BottomSheet's collapsed mode. Slot content stays mounted.
   */
  collapsed?: boolean
  /** When set, shows a back button with this label in the drawer header. */
  backLabel?: string
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })

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
    :class="{ 'side-drawer--collapsed': props.collapsed }"
    role="dialog"
    aria-modal="true"
    :aria-label="props.title ?? props.ariaLabel ?? t('core.drawer.close')"
  >
    <div class="drawer-header">
      <BaseIconButton
        v-if="props.backLabel && !props.collapsed"
        name="arrow_back"
        size="sm"
        :label="`${t('core.drawer.back')} ${props.backLabel}`"
        @click="emit('back')"
      />
      <h2 v-if="props.title" class="drawer-title">
        {{ props.title }}
      </h2>
      <div v-else class="title-spacer" />
      <slot name="header-actions" />
      <BaseIconButton
        v-if="!props.collapsed"
        name="close"
        size="sm"
        :label="t('core.drawer.close')"
        @click="emit('close')"
      />
    </div>
    <div
      class="drawer-content"
      :inert="props.collapsed || undefined"
      :aria-hidden="props.collapsed || undefined"
    >
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="drawer-footer"
      :inert="props.collapsed || undefined"
      :aria-hidden="props.collapsed || undefined"
    >
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
  max-height: 100vh;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-left: 1px solid var(--color-outline-variant);
  box-shadow: var(--shadow-lg);
  animation: slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* Restore pointer events — parent sheet-container sets pointer-events: none */
  pointer-events: auto;
  transition:
    max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    border-bottom-left-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.side-drawer--collapsed {
  /* Collapse vertically to header-only; width unchanged */
  max-height: 4.5rem;
  border-bottom: 1px solid var(--color-outline-variant);
  border-bottom-left-radius: var(--radius-lg);
  border-top-left-radius: 0;
  /* Keep the same animation-name so toggling collapsed off doesn't restart slide-in-right */
}

.side-drawer--collapsed .drawer-header {
  border-bottom: none;
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
  flex-shrink: 0;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.drawer-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.title-spacer {
  flex: 1;
}

.drawer-content {
  /* Published so slotted content can bleed a full-width divider to the drawer edges. */
  --surface-pad-left: var(--spacing-xl);
  --surface-pad-right: var(--spacing-xs);

  overflow-y: auto;
  /* Explicit: an unset overflow-x computes to `auto` alongside overflow-y here
     (CSS Overflow spec), which would silently open a horizontal scrollbar the
     moment any row's content is a pixel too wide. Drawers scroll vertically only. */
  overflow-x: hidden;
  /* Overscroll stops here — never chains to the page or the map beside the
     drawer. Scoped to this scroll region only: the still-visible map keeps its
     own wheel-zoom / pinch / drag. */
  overscroll-behavior: contain;
  padding: var(--spacing-lg) var(--surface-pad-right) var(--spacing-lg) var(--surface-pad-left);
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

.drawer-content::-webkit-scrollbar {
  width: 6px;
}

.drawer-content::-webkit-scrollbar-thumb {
  background-color: var(--color-outline-variant);
  border-radius: 3px;
}

.drawer-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-outline-variant);
  padding: var(--spacing-sm) var(--spacing-xl) var(--spacing-xl);
  opacity: 1;
  transition:
    opacity 0.18s ease-out,
    padding 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-top-color 0.3s;
}

.side-drawer--collapsed .drawer-content,
.side-drawer--collapsed .drawer-footer {
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  flex: 0;
  overflow: hidden;
  pointer-events: none;
}

.side-drawer--collapsed .drawer-footer {
  border-top-color: transparent;
}
</style>
